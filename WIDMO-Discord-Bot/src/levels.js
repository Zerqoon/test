import { randomInt } from 'node:crypto';
import path from 'node:path';
import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, Events, MessageFlags, PermissionFlagsBits as P, SlashCommandBuilder } from 'discord.js';
import { config, ROOT } from './config.js';
import { db, setSetting } from './db.js';
import { leaderboardCard, levelPanelCard, levelUpCard, rankCard } from './cards.js';
import { embed, isBotOwner, replyError, safeText, staffTier } from './shared.js';
import { earnedLevelRoles, isActiveVoiceMember, levelForXp, progressForXp, qualifiedMessage, reconcileVoiceSessions, xpForLevel } from './level-helpers.js';
import { levelRoleDiff, removeLevelReward, setLevelReward } from './level-reward-helpers.js';

const formatNumber = value => Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('pl-PL');

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

// Keep every role ever managed by this system registered so removed thresholds can be
// cleaned up from members instead of leaving stale reward roles behind.
config.roles.retiredLevelRoles ??= [];

function persistLevelRoleConfig(guildId = config.guildId) {
  setSetting(`widmo:${guildId}:roles`, JSON.stringify({ ...config.roles, selfAssignable: [] }));
}

function queueAllLevelRoleReconciliation(guildId = config.guildId) {
  const result = db.prepare(`INSERT INTO level_role_jobs(guild_id,user_id,sync_exact)
    SELECT guild_id,user_id,1 FROM level_stats WHERE guild_id=? AND 1
    ON CONFLICT(guild_id,user_id) DO UPDATE SET sync_exact=1,revision=revision+1,attempts=0,next_attempt=0`).run(guildId);
  return result.changes ?? 0;
}

function canManageLevelRewards(interaction) {
  return isBotOwner(interaction.user.id) || staffTier(interaction.member) >= 2
    || Boolean(interaction.memberPermissions?.has(P.ManageRoles) || interaction.memberPermissions?.has(P.Administrator));
}

function levelPanelComponents() {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('levels:me').setLabel('Moja karta').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('levels:top').setLabel('Ranking TOP 10').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('levels:guide').setLabel('Jak zdobywać XP').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('levels:rewards').setLabel('Nagrody za poziom').setStyle(ButtonStyle.Secondary),
  )];
}

function levelPanelEmbed() {
  return embed('System poziomów i XP',
    'Za aktywność na serwerze zdobywasz XP i kolejne poziomy. Skorzystaj z przycisków, aby sprawdzić swój profil, ranking, zasady naliczania punktów i dostępne nagrody.')
    .setThumbnail('attachment://widmo-logo.png')
    .setImage('attachment://level-panel.png')
    .addFields(
      { name: 'Wiadomości', value: `**${config.xp.messageMin}–${config.xp.messageMax} XP** za kwalifikującą się wiadomość. Limit: raz na ${config.xp.messageCooldownSeconds} s.`, inline: true },
      { name: 'Aktywność głosowa', value: `**${config.xp.voicePerTick} XP** co ${Math.round(config.xp.voiceIntervalSeconds / 60)} min aktywnego voice.`, inline: true },
      { name: 'Nagrody', value: 'Role poziomów są nadawane automatycznie, jeśli nagrody zostały skonfigurowane.', inline: true },
      { name: 'Korzystanie z panelu', value: 'Kliknij **Moja karta**, aby sprawdzić XP i postęp. **Ranking TOP 10** pokazuje najbardziej aktywnych członków.', inline: false },
    )
    .setFooter({ text: 'WIDMO • Poziomy i XP' });
}

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
  const banner = await levelPanelCard();
  const payload = {
    embeds: [levelPanelEmbed()],
    files: [
      new AttachmentBuilder(path.join(ROOT, 'assets/widmo-logo.png'), { name: 'widmo-logo.png' }),
      new AttachmentBuilder(banner, { name: 'level-panel.png' }),
    ],
    components: levelPanelComponents(),
    allowedMentions: { parse: [] },
  };
  if (message) await message.edit({ ...payload, attachments: [] });
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
    const stats = getStats(job.guild_id, job.user_id);
    const diff = levelRoleDiff(stats.level, new Set(member.roles.cache.keys()), config.roles.levels, config.roles.retiredLevelRoles);
    const missing = diff.add;
    const obsolete = diff.remove;
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
    const png = await levelUpCard(member, { ...stats, level: job.level });
    if (!db.prepare('SELECT 1 FROM level_announcements WHERE guild_id=? AND user_id=? AND level=?').get(job.guild_id, job.user_id, job.level)) return;
    await channel.send({
      embeds: [embed('Gratulacje — nowy poziom!', `**${safeText(member.displayName, 100)}** osiąga **poziom ${job.level}**!\nDziękujemy za aktywność na serwerze. Kontynuuj, aby zdobywać kolejne poziomy.`).setImage('attachment://level-up.png').setThumbnail('attachment://widmo-logo.png')],
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
  new SlashCommandBuilder().setName('panel').setDescription('Opublikuj lub odśwież interaktywny panel poziomów WIDMO.'),
  new SlashCommandBuilder().setName('nagrody-poziomu').setDescription('Zarządzaj rolami przyznawanymi za poziomy.')
    .addSubcommand(sub => sub.setName('lista').setDescription('Pokaż skonfigurowane nagrody za poziomy.'))
    .addSubcommand(sub => sub.setName('ustaw').setDescription('Przypisz rolę do poziomu.')
      .addIntegerOption(option => option.setName('poziom').setDescription('Poziom od 1 do 1000.').setMinValue(1).setMaxValue(1000).setRequired(true))
      .addRoleOption(option => option.setName('rola').setDescription('Rola do nadania po osiągnięciu poziomu.').setRequired(true)))
    .addSubcommand(sub => sub.setName('usun').setDescription('Usuń nagrodę z poziomu i posprzątaj tę rolę u członków.')
      .addIntegerOption(option => option.setName('poziom').setDescription('Poziom od 1 do 1000.').setMinValue(1).setMaxValue(1000).setRequired(true))),
];

async function leaderboardEntries(guild) {
  const rows = db.prepare('SELECT user_id,xp FROM level_stats WHERE guild_id=? AND xp>0 ORDER BY xp DESC,user_id ASC LIMIT 10').all(guild.id);
  const entries = await Promise.all(rows.map(async row => {
    let member = await guild.members.fetch(row.user_id).catch(() => null);
    if (!member) {
      const user = await guild.client.users.fetch(row.user_id).catch(() => null);
      if (user) member = { user, displayName: user.globalName ?? user.username, displayAvatarURL: options => user.displayAvatarURL(options) };
    }
    return {
      userId: row.user_id,
      xp: row.xp,
      level: levelForXp(row.xp),
      member,
      name: member?.displayName ?? member?.user?.globalName ?? member?.user?.username ?? `Użytkownik ${row.user_id.slice(-4)}`,
    };
  }));
  return entries;
}

async function sendProfileCard(interaction, user) {
  const member = await interaction.guild.members.fetch(user.id);
  const stats = getStats(interaction.guildId, user.id);
  const png = await rankCard(member, stats);
  return interaction.editReply({
    embeds: [embed(`📊 Profil poziomu ${stats.level}`, `XP: **${formatNumber(stats.xp)}** • Miejsce: **#${stats.rank}**
Zakwalifikowane wiadomości: **${formatNumber(stats.messages)}**
Do awansu: **${formatNumber(stats.neededXp - stats.currentXp)} XP**`)
      .setImage('attachment://rank.png').setThumbnail('attachment://widmo-logo.png')],
    files: [new AttachmentBuilder(png, { name: 'rank.png' }), new AttachmentBuilder(path.join(ROOT, 'assets/widmo-logo.png'), { name: 'widmo-logo.png' })],
    allowedMentions: { parse: [] },
  });
}

async function sendLeaderboard(interaction) {
  const entries = await leaderboardEntries(interaction.guild);
  const png = await leaderboardCard(interaction.guild, entries);
  const list = entries.length
    ? entries.slice(0, 5).map((row, index) => `**${index + 1}.** ${safeText(row.name, 80)} — **LV ${row.level}** · ${formatNumber(row.xp)} XP`).join('\n')
    : 'Ranking nie ma jeszcze wyników. Napisz kilka wiadomości lub porozmawiaj na aktywnym kanale głosowym, aby zdobyć XP.';
  return interaction.editReply({
    embeds: [embed('Ranking aktywności • TOP 10', list).setImage('attachment://leaderboard.png').setThumbnail('attachment://widmo-logo.png')],
    files: [new AttachmentBuilder(png, { name: 'leaderboard.png' }), new AttachmentBuilder(path.join(ROOT, 'assets/widmo-logo.png'), { name: 'widmo-logo.png' })],
    allowedMentions: { parse: [] },
  });
}

export async function handleLevelCommand(interaction) {
  if (!['poziom', 'ranking', 'panel', 'nagrody-poziomu'].includes(interaction.commandName)) return false;
  if (!interaction.guild || interaction.guildId !== config.guildId) { await replyError(interaction, 'Tej komendy użyjesz na naszym serwerze.'); return true; }
  try {
    if (interaction.commandName === 'panel' && !canManageLevelRewards(interaction) && interaction.guild.ownerId !== interaction.user.id) {
      await replyError(interaction, 'Panel poziomów może odświeżać administracja serwera.');
      return true;
    }
    if (interaction.commandName === 'nagrody-poziomu' && !canManageLevelRewards(interaction)) {
      await replyError(interaction, 'Zarządzanie nagrodami wymaga roli Admin/Owner albo uprawnienia Manage Roles.');
      return true;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (interaction.commandName === 'nagrody-poziomu') {
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === 'lista') {
        const entries = Object.entries(config.roles.levels ?? {}).sort((a, b) => Number(a[0]) - Number(b[0]));
        const description = entries.length ? entries.map(([level, roleId]) => `**Poziom ${level}:** <@&${roleId}>`).join('\n') : 'Brak nagród. Użyj `/nagrody-poziomu ustaw`, aby dodać pierwszą rolę.';
        const retired = config.roles.retiredLevelRoles ?? [];
        await interaction.editReply({ embeds: [embed('Nagrody za poziomy', description).addFields({ name: 'Weryfikacja', value: retired.length ? `${retired.length} wcześniej używanych ról czeka na synchronizację/usunięcie od członków.` : 'Brak nieaktywnych ról do posprzątania.' })], allowedMentions: { parse: [] } });
      } else if (subcommand === 'ustaw') {
        const level = interaction.options.getInteger('poziom', true);
        const role = interaction.options.getRole('rola', true);
        const botMember = await interaction.guild.members.fetchMe();
        if (role.id === interaction.guild.id || role.managed || !role.editable || role.position >= botMember.roles.highest.position) {
          throw new Error('Nie można użyć tej roli. Wybierz zwykłą rolę niższą od najwyższej roli bota.');
        }
        if ([P.Administrator, P.ManageGuild, P.ManageRoles].some(permission => role.permissions.has(permission))) {
          throw new Error('Dla bezpieczeństwa nagroda poziomu nie może mieć uprawnień Administrator, Manage Server ani Manage Roles.');
        }
        const next = setLevelReward(config.roles.levels, config.roles.retiredLevelRoles, level, role.id);
        config.roles.levels = next.levels;
        config.roles.retiredLevelRoles = next.retiredLevelRoles;
        persistLevelRoleConfig(interaction.guildId);
        const queued = queueAllLevelRoleReconciliation(interaction.guildId);
        void runJobs(interaction.client).catch(error => console.error('[poziomy] Synchronizacja nagród:', error));
        await interaction.editReply({ content: `Ustawiono nagrodę **${role.name}** na poziomie **${level}**. W kolejce synchronizacji: ${queued} profili. Bot będzie nadawać i usuwać role zgodnie z aktualnym poziomem.`, allowedMentions: { parse: [] } });
      } else if (subcommand === 'usun') {
        const level = interaction.options.getInteger('poziom', true);
        const next = removeLevelReward(config.roles.levels, config.roles.retiredLevelRoles, level);
        config.roles.levels = next.levels;
        config.roles.retiredLevelRoles = next.retiredLevelRoles;
        persistLevelRoleConfig(interaction.guildId);
        const queued = queueAllLevelRoleReconciliation(interaction.guildId);
        void runJobs(interaction.client).catch(error => console.error('[poziomy] Usuwanie nagród:', error));
        await interaction.editReply({ content: `Usunięto nagrodę z poziomu **${level}**. Jej rola zostanie usunięta u osób, które nie spełniają już progów. W kolejce: ${queued} profili.`, allowedMentions: { parse: [] } });
      }
    } else if (interaction.commandName === 'panel') {
      if (!config.channels.levels) throw new Error('Nie ustawiono kanału poziomów w config.json.');
      await ensureLevelInfo(interaction.client);
      await interaction.editReply({ content: `Panel poziomów został opublikowany lub odświeżony w <#${config.channels.levels}>. Przyciski są dostępne dla wszystkich członków.`, allowedMentions: { parse: [] } });
    } else if (interaction.commandName === 'poziom') {
      const user = interaction.options.getUser('uzytkownik') || interaction.user;
      await sendProfileCard(interaction, user);
    } else {
      await sendLeaderboard(interaction);
    }
  } catch (error) { console.error('[poziomy] Komenda:', error); await replyError(interaction, 'Nie udało się przygotować panelu poziomów. Sprawdź logi i uprawnienia bota.'); }
  return true;
}

export async function handleLevelComponent(interaction) {
  if (!interaction.isButton?.() || !String(interaction.customId).startsWith('levels:')) return false;
  if (!interaction.inGuild?.() || interaction.guildId !== config.guildId) {
    await replyError(interaction, 'Ten panel działa tylko na skonfigurowanym serwerze.');
    return true;
  }
  const action = interaction.customId.split(':')[1];
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (action === 'me') {
      await sendProfileCard(interaction, interaction.user);
    } else if (action === 'top') {
      await sendLeaderboard(interaction);
    } else if (action === 'guide') {
      const guide = `Każda kwalifikująca się wiadomość daje losowo **${config.xp.messageMin}–${config.xp.messageMax} XP**. Powtarzanie tej samej treści i spam nie przyspieszą awansu.

` +
        `**Czat:** co najmniej ${config.xp.minMessageLength} znaków, XP nie częściej niż raz na ${config.xp.messageCooldownSeconds} sekund.
` +
        `**Voice:** ${config.xp.voicePerTick} XP co ${Math.round(config.xp.voiceIntervalSeconds / 60)} minut przy minimum ${config.xp.voiceMinHumans} aktywnych osobach. AFK, mute i deaf nie naliczają XP.
` +
        `**Booster:** mnożnik ×${config.xp.boosterMultiplier}.

Sprawdź kartę przyciskiem **Moja karta** i obserwuj postęp do kolejnej rangi.`;
      await interaction.editReply({ embeds: [embed('Jak zdobywać XP?', guide).setThumbnail('attachment://widmo-logo.png')], files: [new AttachmentBuilder(path.join(ROOT, 'assets/widmo-logo.png'), { name: 'widmo-logo.png' })], allowedMentions: { parse: [] } });
    } else if (action === 'rewards') {
      const rewards = Object.entries(config.roles.levels ?? {}).sort((a,b) => Number(a[0]) - Number(b[0]));
      const description = rewards.length
        ? rewards.map(([level, roleId]) => `**Poziom ${level}**  →  <@&${roleId}>`).join('\n')
        : 'Nagrody nie zostały jeszcze skonfigurowane. Gdy administracja ustawi role w `config.json`, będą tutaj widoczne.';
      await interaction.editReply({ embeds: [embed('Nagrody za poziomy', `Awans zapisuje się w systemie poziomów, a skonfigurowane role są nadawane automatycznie.

${description}`).setThumbnail('attachment://widmo-logo.png')], files: [new AttachmentBuilder(path.join(ROOT, 'assets/widmo-logo.png'), { name: 'widmo-logo.png' })], allowedMentions: { parse: [] } });
    } else {
      await replyError(interaction, 'Ten przycisk jest nieaktualny. Odśwież panel komendą `/panel`.');
    }
  } catch (error) {
    console.error('[poziomy] Przycisk panelu:', error);
    await replyError(interaction, 'Nie udało się wykonać tej akcji. Spróbuj ponownie.');
  }
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
      // Reconcile all known profiles when reward mappings exist. This repairs missing
      // grants and removes role IDs retired by an administrator without inventing IDs.
      if (Object.keys(config.roles.levels ?? {}).length || (config.roles.retiredLevelRoles ?? []).length) {
        queueAllLevelRoleReconciliation(config.guildId);
      }
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
