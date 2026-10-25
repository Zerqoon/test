import { randomInt } from 'node:crypto';
import path from 'node:path';
import { AttachmentBuilder, Events, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { config, ROOT } from './config.js';
import { db } from './db.js';
import { rankCard } from './cards.js';
import { embed, replyError, safeText } from './shared.js';
import { earnedLevelRoles, isActiveVoiceMember, levelForXp, progressForXp, qualifiedMessage, reconcileVoiceSessions, xpForLevel } from './level-helpers.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS level_stats (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, xp REAL NOT NULL DEFAULT 0,
    messages INTEGER NOT NULL DEFAULT 0, last_message_at INTEGER,
    last_message_hash TEXT, last_message_id TEXT,
    PRIMARY KEY (guild_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS level_stats_ranking ON level_stats(guild_id, xp DESC);
  CREATE TABLE IF NOT EXISTS level_role_jobs (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(guild_id,user_id)
  );
  CREATE TABLE IF NOT EXISTS level_announcements (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, level INTEGER NOT NULL,
    next_attempt INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id,user_id,level)
  );
`);

// Additive migration keeps XP and queued work from existing Railway volumes intact.
const jobColumns = new Set(db.prepare('PRAGMA table_info(level_role_jobs)').all().map(c => c.name));
if (!jobColumns.has('sync_exact')) db.exec('ALTER TABLE level_role_jobs ADD COLUMN sync_exact INTEGER NOT NULL DEFAULT 0');
if (!jobColumns.has('revision')) db.exec('ALTER TABLE level_role_jobs ADD COLUMN revision INTEGER NOT NULL DEFAULT 0');

const selectStats = db.prepare('SELECT * FROM level_stats WHERE guild_id=? AND user_id=?');
const upsertEmpty = db.prepare('INSERT OR IGNORE INTO level_stats(guild_id,user_id) VALUES(?,?)');
const addXpStatement = db.prepare('UPDATE level_stats SET xp=xp+? WHERE guild_id=? AND user_id=?');
const addMessageStatement = db.prepare('UPDATE level_stats SET messages=messages+1,last_message_at=?,last_message_hash=?,last_message_id=? WHERE guild_id=? AND user_id=?');
const queueRoles = db.prepare('INSERT INTO level_role_jobs(guild_id,user_id) VALUES(?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET revision=revision+1');
const queueAnnouncement = db.prepare('INSERT OR IGNORE INTO level_announcements(guild_id,user_id,level) VALUES(?,?,?)');
let activeClient;
let jobsRunning = false;

export function getStats(guildId, userId) {
  const row = selectStats.get(guildId, userId) || { xp: 0, messages: 0 };
  const rank = db.prepare('SELECT COUNT(*)+1 AS rank FROM level_stats WHERE guild_id=? AND (xp>? OR (xp=? AND user_id<?))').get(guildId, row.xp, row.xp, userId).rank;
  return { xp: row.xp, messages: row.messages, rank, ...progressForXp(row.xp) };
}

export async function ensureLevelInfo(client) {
  if (!config.channels.levels) return false;
  const channel = await client.channels.fetch(config.channels.levels);
  if (!channel?.isTextBased?.() || !channel.send || channel.guildId !== config.guildId) {
    throw new Error('Kanał informacji o poziomach musi być kanałem tekstowym na skonfigurowanym serwerze.');
  }
  const key = `widmo:level-info:${config.guildId}`;
  const savedId = db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value;
  let message = null;
  if (savedId) {
    try { message = await channel.messages.fetch(savedId); }
    catch (error) { if (error?.code !== 10008) throw error; }
    if (message && message.author.id !== client.user.id) message = null;
  }
  const info = embed('𖤐 ARCHIWUM DUSZ • POZIOMY WIDMO',
    'Każda wiadomość i każda chwila spędzona na rozmowie przybliża Cię do kolejnej rangi. Zdobywaj XP uczciwie, awansuj i zapisuj swoją historię w Archiwum Dusz.')
    .setThumbnail('attachment://widmo-logo.png')
    .addFields(
      { name: '✦ XP za wiadomości', value: `Otrzymujesz **${config.xp.messageMin}–${config.xp.messageMax} XP** za kwalifikującą się wiadomość. Kolejne XP naliczane są maksymalnie raz na **${config.xp.messageCooldownSeconds} sekund**; wiadomość musi mieć co najmniej **${config.xp.minMessageLength} znaków**.`, inline: false },
      { name: '☾ Aktywność głosowa', value: `Otrzymujesz **${config.xp.voicePerTick} XP co ${Math.round(config.xp.voiceIntervalSeconds / 60)} min**, gdy na kanale są minimum **${config.xp.voiceMinHumans} aktywne osoby**. System pomija AFK i osoby, które nie spełniają wymagań aktywności.`, inline: false },
      { name: '♛ Booster WIDMA', value: `Rola Booster otrzymuje mnożnik **×${config.xp.boosterMultiplier} XP**.`, inline: true },
      { name: '𖤐 Sprawdź swoje statystyki', value: 'Użyj **`/poziom`**, aby zobaczyć kartę duszy, XP, pasek postępu i miejsce w rankingu. **`/ranking`** pokazuje TOP 10 aktywnych osób.', inline: true },
      { name: '⚜ Nagrody', value: 'Role poziomów są nadawane automatycznie, jeżeli administracja skonfigurowała nagrody. Spam, powtarzane wiadomości i sztuczne nabijanie XP nie przyspieszą drogi przez kryptę.', inline: false },
    )
    .setFooter({ text: 'WIDMO • Każdy poziom to kolejny ślad w cieniu.' });
  const payload = {
    embeds: [info],
    files: [new AttachmentBuilder(path.join(ROOT, 'assets/widmo-logo.png'), { name: 'widmo-logo.png' })],
    allowedMentions: { parse: [] },
  };
  if (message) await message.edit(payload);
  else {
    message = await channel.send(payload);
    db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, message.id);
  }
  return true;
}

export async function setMemberXp(member, xp) {
  if (!Number.isFinite(xp) || xp < 0 || xp > 10_000_000) throw new Error('XP musi być liczbą od 0 do 10 000 000.');
  if (member.guild.id !== config.guildId || member.user.bot) throw new Error('Wybierz osobę na skonfigurowanym serwerze.');
  const guildId = member.guild.id, userId = member.id;
  db.exec('BEGIN IMMEDIATE');
  try {
    upsertEmpty.run(guildId, userId);
    // Keep legitimate message counts and anti-spam timestamps unchanged.
    db.prepare('UPDATE level_stats SET xp=? WHERE guild_id=? AND user_id=?').run(xp, guildId, userId);
    db.prepare(`INSERT INTO level_role_jobs(guild_id,user_id,sync_exact) VALUES(?,?,1)
      ON CONFLICT(guild_id,user_id) DO UPDATE SET sync_exact=1,revision=revision+1,attempts=0,next_attempt=0`).run(guildId, userId);
    db.prepare('DELETE FROM level_announcements WHERE guild_id=? AND user_id=?').run(guildId, userId);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  if (activeClient) await runJobs(activeClient);
  return getStats(guildId, userId);
}

function addXp(member, xp, messageData) {
  const guildId = member.guild.id;
  const userId = member.id;
  const old = selectStats.get(guildId, userId);
  const oldLevel = levelForXp(old?.xp || 0);
  db.exec('BEGIN IMMEDIATE');
  try {
    upsertEmpty.run(guildId, userId);
    addXpStatement.run(xp, guildId, userId);
    if (messageData) addMessageStatement.run(messageData.at, messageData.hash, messageData.id, guildId, userId);
    const newLevel = levelForXp((old?.xp || 0) + xp);
    if (earnedLevelRoles(newLevel, config.roles.levels).length) queueRoles.run(guildId, userId);
    if (newLevel > oldLevel) queueAnnouncement.run(guildId, userId, newLevel);
    db.exec('COMMIT');
    return newLevel;
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export async function handleXpMessage(message) {
  if (!message.guild || message.guild.id !== config.guildId || message.author?.bot || !message.member) return;
  const previous = selectStats.get(message.guild.id, message.author.id);
  if (previous?.last_message_id === message.id) return;
  const at = message.createdTimestamp || Date.now();
  const qualified = qualifiedMessage(message.content, previous, at, config.xp);
  if (!qualified.qualifies) return;
  const base = randomInt(config.xp.messageMin, config.xp.messageMax + 1);
  const multiplier = message.member.roles.cache.has(config.roles.booster) ? config.xp.boosterMultiplier : 1;
  addXp(message.member, base * multiplier, { at, hash: qualified.hash, id: message.id });
  if (activeClient) await runJobs(activeClient);
}

async function processRoleJob(client, job) {
  const guild = client.guilds.cache.get(job.guild_id);
  if (!guild) return;
  const remove = () => db.prepare('DELETE FROM level_role_jobs WHERE guild_id=? AND user_id=? AND revision=?').run(job.guild_id, job.user_id, job.revision);
  try {
    const member = await guild.members.fetch(job.user_id);
    const roles = earnedLevelRoles(getStats(job.guild_id, job.user_id).level, config.roles.levels);
    const missing = roles.filter((roleId) => !member.roles.cache.has(roleId));
    const obsolete = job.sync_exact ? Object.values(config.roles.levels).filter(id => !roles.includes(id) && member.roles.cache.has(id)) : [];
    // Assigning a role can bypass Discord Membership Screening; wait for acceptance first.
    if (missing.length && member.pending) {
      db.prepare('UPDATE level_role_jobs SET next_attempt=? WHERE guild_id=? AND user_id=?').run(Date.now() + 30_000, job.guild_id, job.user_id);
      return;
    }
    for (const roleId of missing) {
      const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId);
      if (!role) throw new Error(`Nie istnieje rola poziomu ${roleId}`);
      if (!role.editable) throw new Error(`Rola bota musi być wyżej niż rola poziomu ${roleId}`);
      // A single-role endpoint does not overwrite unrelated roles added concurrently by autoroles.
      await member.roles.add(roleId, 'Osiągnięty poziom — automatyczna nagroda');
    }
    for (const roleId of obsolete) {
      const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId);
      if (!role) continue;
      if (!role.editable) throw new Error(`Rola bota musi być wyżej niż rola poziomu ${roleId}`);
      await member.roles.remove(roleId, 'Ręczna korekta XP — dopasowanie roli do poziomu');
    }
    remove();
  } catch (error) {
    if (error.code === 10007) { remove(); return; }
    const attempts = job.attempts + 1;
    db.prepare('UPDATE level_role_jobs SET attempts=?,next_attempt=? WHERE guild_id=? AND user_id=?')
      .run(attempts, Date.now() + Math.min(3_600_000, 30_000 * (2 ** Math.min(attempts, 7))), job.guild_id, job.user_id);
    if (attempts === 1 || attempts % 5 === 0) console.error(`[poziomy] Ponowimy nadanie ról dla ${job.user_id}:`, error);
  }
}

async function processAnnouncement(client, job) {
  const remove = () => db.prepare('DELETE FROM level_announcements WHERE guild_id=? AND user_id=? AND level=?').run(job.guild_id, job.user_id, job.level);
  try {
    const guild = client.guilds.cache.get(job.guild_id);
    if (!guild) return;
    const member = await guild.members.fetch(job.user_id);
    const stats = getStats(job.guild_id, job.user_id);
    const channel = await client.channels.fetch(config.channels.levels);
    if (!channel?.isTextBased() || !channel.isSendable() || channel.guildId !== job.guild_id) throw new Error('Kanał poziomów nie jest dostępny');
    const png = await rankCard(member, stats);
    if (!db.prepare('SELECT 1 FROM level_announcements WHERE guild_id=? AND user_id=? AND level=?').get(job.guild_id, job.user_id, job.level)) return;
    await channel.send({
      embeds: [embed('𖤐 Dusza zyskała moc!', `**${safeText(member.displayName, 100)}** osiąga **${job.level}. poziom**!\nPisanie i aktywny voice zbliżają Cię do kolejnej rangi. Niech WIDMO pozna Twoją moc.`).setImage('attachment://level-up.png').setThumbnail('attachment://widmo-logo.png')],
      files: [new AttachmentBuilder(png, { name: 'level-up.png' }), new AttachmentBuilder(path.join(ROOT, 'assets/widmo-logo.png'), { name: 'widmo-logo.png' })], allowedMentions: { parse: [] },
    });
    remove();
  } catch (error) {
    if (error.code === 10007) { remove(); return; }
    const attempts = job.attempts + 1;
    db.prepare('UPDATE level_announcements SET attempts=?,next_attempt=? WHERE guild_id=? AND user_id=? AND level=?')
      .run(attempts, Date.now() + Math.min(3_600_000, 30_000 * (2 ** Math.min(attempts, 7))), job.guild_id, job.user_id, job.level);
    if (attempts === 1 || attempts % 5 === 0) console.error('[poziomy] Ponowimy publikację awansu:', error);
  }
}

async function runJobs(client) {
  if (jobsRunning || !client.isReady()) return;
  jobsRunning = true;
  try {
    const roles = db.prepare('SELECT * FROM level_role_jobs WHERE guild_id=? AND next_attempt<=? LIMIT 20').all(config.guildId, Date.now());
    for (const job of roles) await processRoleJob(client, job);
    const announcements = db.prepare('SELECT * FROM level_announcements WHERE guild_id=? AND next_attempt<=? ORDER BY level LIMIT 5').all(config.guildId, Date.now());
    for (const job of announcements) await processAnnouncement(client, job);
  } finally { jobsRunning = false; }
}

export const levelCommands = [
  new SlashCommandBuilder().setName('poziom').setDescription('Twoja karta poziomu, XP i miejsce w rankingu.').addUserOption((option) => option.setName('uzytkownik').setDescription('Sprawdź wybraną osobę.')),
  new SlashCommandBuilder().setName('ranking').setDescription('10 najbardziej aktywnych osób na serwerze.'),
];

export async function handleLevelCommand(interaction) {
  if (!['poziom', 'ranking'].includes(interaction.commandName)) return false;
  if (!interaction.guild || interaction.guildId !== config.guildId) { await replyError(interaction, 'Tej komendy użyjesz na naszym serwerze.'); return true; }
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (interaction.commandName === 'poziom') {
      const user = interaction.options.getUser('uzytkownik') || interaction.user;
      const member = await interaction.guild.members.fetch(user.id);
      const stats = getStats(interaction.guildId, user.id);
      const png = await rankCard(member, stats);
      await interaction.editReply({
        embeds: [embed(`𖤐 Karta duszy • poziom ${stats.level}`, `XP: **${stats.xp.toLocaleString('pl-PL')}** • Miejsce: **#${stats.rank}**\nZakwalifikowane wiadomości: **${stats.messages}**\nDo awansu: **${(stats.neededXp - stats.currentXp).toLocaleString('pl-PL')} XP**`).setImage('attachment://rank.png').setThumbnail('attachment://widmo-logo.png')],
        files: [new AttachmentBuilder(png, { name: 'rank.png' }), new AttachmentBuilder(path.join(ROOT, 'assets/widmo-logo.png'), { name: 'widmo-logo.png' })], allowedMentions: { parse: [] },
      });
    } else {
      const rows = db.prepare('SELECT user_id,xp FROM level_stats WHERE guild_id=? ORDER BY xp DESC,user_id ASC LIMIT 10').all(interaction.guildId);
      await interaction.editReply({
        embeds: [embed('♛ Tablica dusz • ranking aktywności', rows.map((row, index) => `**${index + 1}.** <@${row.user_id}> — **LV ${levelForXp(row.xp)}** • ${row.xp.toLocaleString('pl-PL')} XP`).join('\n') || 'Krypta czeka na pierwszą duszę w rankingu.').setThumbnail('attachment://widmo-logo.png')], files: [new AttachmentBuilder(path.join(ROOT, 'assets/widmo-logo.png'), { name: 'widmo-logo.png' })], allowedMentions: { parse: [] },
      });
    }
  } catch (error) { console.error('[poziomy] Komenda:', error); await replyError(interaction, 'Nie udało się przygotować poziomu. Spróbuj ponownie.'); }
  return true;
}

export function installLevels(client) {
  activeClient = client;
  const sessions = new Map();
  let stopped = false;
  let voiceRunning = false;
  let lastVoiceTick = Date.now();
  const intervalMs = config.xp.voiceIntervalSeconds * 1000;

  function refreshVoice(now = Date.now()) {
    const eligible = new Map();
    const guild = client.guilds.cache.get(config.guildId);
    if (!client.isReady() || !guild?.available) { sessions.clear(); return; }
    for (const channel of guild.channels.cache.values()) {
      if (!channel.isVoiceBased() || channel.id === config.channels.voiceCreator || channel.id === guild.afkChannelId) continue;
      const active = [...channel.members.values()].filter((member) => isActiveVoiceMember(member, guild.afkChannelId));
      if (active.length < config.xp.voiceMinHumans) continue;
      for (const member of active) eligible.set(member.id, { channelId: channel.id, member });
    }
    reconcileVoiceSessions(sessions, eligible, now);
  }

  async function tickVoice() {
    if (voiceRunning || stopped) return;
    voiceRunning = true;
    try {
      const now = Date.now();
      if (now - lastVoiceTick > 30_000) sessions.clear();
      lastVoiceTick = now;
      refreshVoice(now);
      for (const session of sessions.values()) {
        if (now - session.since < intervalMs) continue;
        session.since = now; // No retroactive XP for machine suspension / disconnected time.
        const member = session.member;
        const multiplier = member.roles.cache.has(config.roles.booster) ? config.xp.boosterMultiplier : 1;
        addXp(member, config.xp.voicePerTick * multiplier);
      }
      await runJobs(client);
    } catch (error) { console.error('[poziomy] Naliczanie voice:', error); }
    finally { voiceRunning = false; }
  }

  const onVoice = (oldState, newState) => {
    if ((newState.guild || oldState.guild)?.id !== config.guildId) return;
    try { refreshVoice(); } catch (error) { console.error('[poziomy] Zmiana voice:', error); }
  };
  const onJoin = (member) => {
    if (member.guild.id !== config.guildId || member.user.bot) return;
    try { queueRoles.run(member.guild.id, member.id); void runJobs(client).catch((error) => console.error('[poziomy] Przywrócenie ról:', error)); }
    catch (error) { console.error('[poziomy] Przywrócenie ról:', error); }
  };
  const onReady = () => {
    try {
      sessions.clear();
      refreshVoice();
      // Repair previously earned roles on restarts, including failures before an earlier shutdown.
      db.prepare('INSERT OR IGNORE INTO level_role_jobs(guild_id,user_id) SELECT guild_id,user_id FROM level_stats WHERE guild_id=? AND xp>=?').run(config.guildId, xpForLevel(Math.min(...Object.keys(config.roles.levels).map(Number))));
      void runJobs(client).catch((error) => console.error('[poziomy] Start:', error));
    } catch (error) { console.error('[poziomy] Start:', error); }
  };
  const onMemberUpdate = (before, after) => {
    if (after.guild.id !== config.guildId || !before.pending || after.pending) return;
    try {
      queueRoles.run(after.guild.id, after.id);
      db.prepare('UPDATE level_role_jobs SET next_attempt=0 WHERE guild_id=? AND user_id=?').run(after.guild.id, after.id);
      void runJobs(client).catch((error) => console.error('[poziomy] Role po akceptacji regulaminu:', error));
    } catch (error) { console.error('[poziomy] Role po akceptacji regulaminu:', error); }
  };
  const onDisconnect = () => sessions.clear();
  client.on(Events.VoiceStateUpdate, onVoice);
  client.on(Events.GuildMemberAdd, onJoin);
  client.on(Events.GuildMemberUpdate, onMemberUpdate);
  client.on(Events.ClientReady, onReady);
  client.on(Events.ShardDisconnect, onDisconnect);
  client.on(Events.ShardReconnecting, onDisconnect);
  client.on(Events.ShardResume, onDisconnect);
  if (client.isReady()) onReady();
  const timer = setInterval(() => { void tickVoice(); }, 5000);
  timer.unref?.();
  return { stop() {
    stopped = true;
    clearInterval(timer);
    sessions.clear();
    if (activeClient === client) activeClient = undefined;
    client.off(Events.VoiceStateUpdate, onVoice);
    client.off(Events.GuildMemberAdd, onJoin);
    client.off(Events.GuildMemberUpdate, onMemberUpdate);
    client.off(Events.ClientReady, onReady);
    client.off(Events.ShardDisconnect, onDisconnect);
    client.off(Events.ShardReconnecting, onDisconnect);
    client.off(Events.ShardResume, onDisconnect);
  } };
}
