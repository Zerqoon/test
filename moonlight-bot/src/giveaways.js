import { randomBytes } from 'node:crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { config } from './config.js';
import { db } from './db.js';
import { embed, staffTier, parseDuration, replyError, safeText } from './shared.js';
import { getStats } from './levels.js';
import { chooseWinners, giveawayEligibility } from './giveaway-utils.js';

const locks = new Set();
const supportedChannels = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
db.exec(`
  CREATE TABLE IF NOT EXISTS giveaways (
    id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL, message_id TEXT,
    host_id TEXT NOT NULL, prize TEXT NOT NULL, description TEXT NOT NULL,
    role_id TEXT, min_messages INTEGER NOT NULL DEFAULT 0, winner_count INTEGER NOT NULL DEFAULT 1,
    ends_at INTEGER NOT NULL, created_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'publishing',
    winners TEXT NOT NULL DEFAULT '[]', previous_winners TEXT NOT NULL DEFAULT '[]',
    round INTEGER NOT NULL DEFAULT 1, announced INTEGER NOT NULL DEFAULT 0, last_error TEXT
  );
  CREATE INDEX IF NOT EXISTS giveaways_due ON giveaways(guild_id, status, ends_at);
  CREATE TABLE IF NOT EXISTS giveaway_entries (
    giveaway_id TEXT NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, joined_at INTEGER NOT NULL,
    PRIMARY KEY(giveaway_id, user_id)
  );
`);

const giveaway = new SlashCommandBuilder().setName('giveaway').setDescription('Twórz i obsługuj giveaway (Admin i Szef)').setDMPermission(false)
  .addSubcommand(sub => sub.setName('start').setDescription('Utwórz giveaway z wymaganiami')
    .addStringOption(option => option.setName('nagroda').setDescription('Co można wygrać?').setMaxLength(250).setRequired(true))
    .addStringOption(option => option.setName('czas').setDescription('Np. 1h, 3d; maksymalnie 30 dni').setRequired(true))
    .addStringOption(option => option.setName('wiadomosc').setDescription('Opis i dodatkowe informacje').setMaxLength(1500))
    .addRoleOption(option => option.setName('rola').setDescription('Rola wymagana przy dołączaniu i losowaniu'))
    .addIntegerOption(option => option.setName('wiadomosci').setDescription('Minimum poprawnych wiadomości zliczonych przez bota').setMinValue(0).setMaxValue(1_000_000))
    .addIntegerOption(option => option.setName('zwyciezcy').setDescription('Liczba zwycięzców').setMinValue(1).setMaxValue(config.giveaways.maxWinners))
    .addChannelOption(option => option.setName('kanal').setDescription('Kanał publikacji; domyślnie obecny').addChannelTypes(...supportedChannels)))
  .addSubcommand(sub => sub.setName('koniec').setDescription('Zakończ giveaway i wylosuj zwycięzców')
    .addStringOption(option => option.setName('id').setDescription('ID giveaway ze stopki lub ID jego wiadomości').setRequired(true).setMaxLength(30)))
  .addSubcommand(sub => sub.setName('reroll').setDescription('Wylosuj nowe osoby; poprzedni zwycięzcy są pomijani')
    .addStringOption(option => option.setName('id').setDescription('ID giveaway ze stopki lub ID jego wiadomości').setRequired(true).setMaxLength(30)));
export const giveawayCommands = [giveaway];

function getGiveaway(id, guildId) {
  return db.prepare('SELECT * FROM giveaways WHERE (id = ? OR message_id = ?) AND guild_id = ?').get(id, id, guildId);
}

function entryCount(id) {
  return db.prepare('SELECT COUNT(*) AS count FROM giveaway_entries WHERE giveaway_id = ?').get(id).count;
}

function giveawayPayload(item) {
  const finished = item.status === 'finished';
  const drawing = item.status === 'drawing';
  const description = [item.description, `**Nagroda:** ${item.prize}`].filter(Boolean).join('\n\n');
  const card = embed(finished ? '🎉 Giveaway zakończony' : drawing ? '🎲 Trwa losowanie' : '🎁 Giveaway • dołącz poniżej', description)
    .addFields(
      { name: 'Termin', value: `<t:${Math.floor(item.ends_at / 1000)}:F>\n<t:${Math.floor(item.ends_at / 1000)}:R>`, inline: true },
      { name: 'Liczba zwycięzców', value: String(item.winner_count), inline: true },
      { name: 'Zgłoszenia', value: String(entryCount(item.id)), inline: true },
      { name: 'Wymagania', value: `${item.role_id ? `Rola: <@&${item.role_id}>` : 'Rola: dowolna'}\nPoprawne wiadomości: **${item.min_messages}**\nObecność na serwerze i spełnienie warunków również podczas losowania.` },
      { name: 'Organizator', value: `<@${item.host_id}>` },
    ).setFooter({ text: `${config.serverName} • ID: ${item.id} • losowanie ${item.round}` });
  if (finished) {
    const winners = JSON.parse(item.winners);
    card.addFields({ name: '🏆 Zwycięzcy', value: winners.length ? winners.map(id => `<@${id}>`).join(', ') : 'Brak zgłoszonych osób spełniających warunki.' });
    if (winners.length && winners.length < item.winner_count) card.addFields({ name: 'Informacja', value: 'Liczba kwalifikujących się uczestników była mniejsza niż liczba nagród.' });
    card.addFields({ name: 'Odbiór nagrody', value: 'Nagrodę przekazuje organizator. Skontaktuj się z nim w sprawie odbioru.' });
  }
  return { embeds: [card], allowedMentions: { parse: [] }, components: [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`giveaway:join:${item.id}`).setLabel('Weź udział').setEmoji('🎉').setStyle(ButtonStyle.Success).setDisabled(finished || drawing),
    new ButtonBuilder().setCustomId(`giveaway:leave:${item.id}`).setLabel('Wycofaj udział').setStyle(ButtonStyle.Secondary).setDisabled(finished || drawing),
    new ButtonBuilder().setCustomId(`giveaway:status:${item.id}`).setLabel('Moje wymagania').setStyle(ButtonStyle.Secondary),
  )] };
}

async function memberOrNull(guild, id) {
  try { return await guild.members.fetch({ user: id, force: true }); }
  catch (error) { if (error.code === 10007) return null; throw error; }
}

async function eligibility(guild, item, userId) {
  const member = await memberOrNull(guild, userId);
  return giveawayEligibility(member, item.role_id, item.min_messages, getStats(item.guild_id, userId).messages);
}

async function requireAdmin(interaction) {
  const actor = await memberOrNull(interaction.guild, interaction.user.id);
  if (staffTier(actor) < 2) throw new Error('Giveaway może tworzyć i kończyć wyłącznie Admin lub Szef.');
  return actor;
}

async function getChannel(client, item) {
  const guild = await client.guilds.fetch(item.guild_id);
  const channel = await guild.channels.fetch(item.channel_id);
  if (!channel || !supportedChannels.includes(channel.type)) throw new Error('Kanał giveaway nie istnieje lub nie jest kanałem tekstowym.');
  return channel;
}

async function updateAnnouncement(client, item, allowReplacement = false) {
  const channel = await getChannel(client, item);
  let message;
  if (item.message_id) {
    try { message = await channel.messages.fetch(item.message_id); }
    catch (error) { if (error.code !== 10008) throw error; }
  }
  if (message) {
    await message.edit(giveawayPayload(item));
    return message;
  }
  if (!allowReplacement) return null;
  message = await channel.send({ ...giveawayPayload(item), nonce: item.id, enforceNonce: true });
  db.prepare('UPDATE giveaways SET message_id = ? WHERE id = ?').run(message.id, item.id);
  return message;
}

async function publishGiveaway(client, item) {
  // Persist before sending; a failed send is retried from durable state.
  const message = await updateAnnouncement(client, item, true);
  db.prepare("UPDATE giveaways SET status='open', message_id=?, last_error=NULL WHERE id=? AND status='publishing'").run(message.id, item.id);
  return message;
}

async function drawGiveaway(client, id) {
  if (locks.has(id)) return false;
  locks.add(id);
  let item;
  try {
    item = db.prepare('SELECT * FROM giveaways WHERE id=?').get(id);
    if (!item || item.status === 'finished' || item.status === 'publishing') return false;
    db.prepare("UPDATE giveaways SET status='drawing' WHERE id=? AND status IN ('open','drawing')").run(id);
    item.status = 'drawing';
    const guild = await client.guilds.fetch(item.guild_id);
    const excluded = new Set(JSON.parse(item.previous_winners));
    const entries = db.prepare('SELECT user_id FROM giveaway_entries WHERE giveaway_id=? ORDER BY joined_at, user_id').all(id);
    const eligible = [];
    // Fetch sequentially to respect Discord's REST rate limiter; a network failure aborts
    // the draw rather than unfairly treating an unverified participant as ineligible.
    for (const { user_id: userId } of entries) {
      if (!excluded.has(userId) && !(await eligibility(guild, item, userId))) eligible.push(userId);
    }
    const winners = chooseWinners(eligible, item.winner_count);
    // Result is committed before announcement. A retry always edits with this same draw.
    db.prepare("UPDATE giveaways SET status='finished', winners=?, announced=0, last_error=NULL WHERE id=? AND status='drawing'").run(JSON.stringify(winners), id);
    const result = db.prepare('SELECT * FROM giveaways WHERE id=?').get(id);
    await updateAnnouncement(client, result, true);
    db.prepare('UPDATE giveaways SET announced=1, last_error=NULL WHERE id=?').run(id);
    return true;
  } catch (error) {
    db.prepare('UPDATE giveaways SET last_error=? WHERE id=?').run(safeText(error.message, 1000), id);
    throw error;
  } finally { locks.delete(id); }
}

export async function handleGiveawayCommand(interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'giveaway') return false;
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const actor = await requireAdmin(interaction);
    const sub = interaction.options.getSubcommand();
    if (sub === 'start') {
      const duration = parseDuration(interaction.options.getString('czas', true), { min: 60_000, max: config.giveaways.maxDurationDays * 86_400_000 });
      const channel = interaction.options.getChannel('kanal') ?? interaction.channel;
      if (!channel || !supportedChannels.includes(channel.type)) throw new Error('Wybierz zwykły kanał tekstowy lub kanał ogłoszeń.');
      const bot = await interaction.guild.members.fetchMe();
      if (!channel.permissionsFor(bot)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory])) {
        throw new Error('Bot potrzebuje na kanale uprawnień do czytania historii, wyświetlania, wysyłania i osadzania linków.');
      }
      if (!channel.permissionsFor(actor)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) throw new Error('Nie masz dostępu do publikacji na wybranym kanale.');
      const count = db.prepare("SELECT COUNT(*) AS total FROM giveaways WHERE guild_id=? AND status!='finished'").get(interaction.guildId).total;
      if (count >= 50) throw new Error('Może działać maksymalnie 50 aktywnych giveaway.');
      const prize = interaction.options.getString('nagroda', true).trim();
      if (!prize) throw new Error('Nazwa nagrody nie może być pusta.');
      const id = randomBytes(12).toString('hex');
      db.prepare(`INSERT INTO giveaways(id,guild_id,channel_id,host_id,prize,description,role_id,min_messages,winner_count,ends_at,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(id, interaction.guildId, channel.id, interaction.user.id, prize,
        interaction.options.getString('wiadomosc')?.trim() || '', interaction.options.getRole('rola')?.id ?? null,
        interaction.options.getInteger('wiadomosci') ?? 0, interaction.options.getInteger('zwyciezcy') ?? 1, Date.now() + duration, Date.now());
      const item = getGiveaway(id, interaction.guildId);
      locks.add(id);
      try {
        const message = await publishGiveaway(interaction.client, item);
        await interaction.editReply({ content: `Giveaway gotowy: ${message.url}\nID: \`${id}\`` });
      } catch (error) {
        db.prepare('UPDATE giveaways SET last_error=? WHERE id=?').run(safeText(error.message, 1000), id);
        console.error('[giveaway publish retry]', error);
        await interaction.editReply({ content: `Giveaway zapisany pod ID \`${id}\`, ale publikacja nie powiodła się. Bot ponowi ją automatycznie co 30 sekund. Sprawdź uprawnienia kanału.` });
      } finally { locks.delete(id); }
      return true;
    }
    const item = getGiveaway(interaction.options.getString('id', true).trim(), interaction.guildId);
    if (!item) throw new Error('Nie znaleziono giveaway o tym ID.');
    if (locks.has(item.id)) throw new Error('To giveaway jest właśnie przetwarzane. Spróbuj za chwilę.');
    if (sub === 'koniec') {
      if (item.status === 'finished') throw new Error('To giveaway jest już zakończone. Nowe losowanie wykonasz komendą /giveaway reroll.');
      if (item.status === 'publishing') throw new Error('Giveaway czeka na publikację. Najpierw sprawdź uprawnienia kanału.');
      db.prepare('UPDATE giveaways SET ends_at=? WHERE id=?').run(Date.now(), item.id);
    } else if (sub === 'reroll') {
      if (item.status !== 'finished') throw new Error('Najpierw zakończ giveaway.');
      const excluded = [...new Set([...JSON.parse(item.previous_winners), ...JSON.parse(item.winners)])];
      db.prepare("UPDATE giveaways SET status='drawing', previous_winners=?, winners='[]', announced=0, round=round+1, ends_at=? WHERE id=? AND status='finished'")
        .run(JSON.stringify(excluded), Date.now(), item.id);
    } else throw new Error('Nieznana komenda giveaway.');
    await drawGiveaway(interaction.client, item.id);
    const result = getGiveaway(item.id, interaction.guildId);
    await interaction.editReply({ content: `Losowanie zakończone: https://discord.com/channels/${result.guild_id}/${result.channel_id}/${result.message_id}` });
  } catch (error) {
    console.error('[giveaway command]', error);
    await replyError(interaction, safeText(error.message, 1500));
  }
  return true;
}

export async function handleGiveawayInteraction(interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith('giveaway:')) return false;
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const [, action, id] = interaction.customId.split(':');
    const item = getGiveaway(id, interaction.guildId);
    if (!item) throw new Error('To giveaway nie jest już dostępne.');
    if (item.message_id !== interaction.message.id) throw new Error('Skorzystaj z przycisków pod aktualną wiadomością giveaway.');
    const existing = db.prepare('SELECT 1 AS present FROM giveaway_entries WHERE giveaway_id=? AND user_id=?').get(id, interaction.user.id);
    if (action === 'status') {
      const problem = await eligibility(interaction.guild, item, interaction.user.id);
      await interaction.editReply({ content: `${existing ? '✅ Masz zapisane zgłoszenie.' : 'Nie masz zapisanego zgłoszenia.'}\n${problem ?? '✅ Spełniasz aktualne wymagania.'}${item.status === 'finished' ? '\nGiveaway jest zakończone.' : ''}`, allowedMentions: { parse: [] } });
      return true;
    }
    if (item.status !== 'open' || item.ends_at <= Date.now()) throw new Error('Zapisy do tego giveaway są zakończone.');
    if (action === 'join') {
      if (existing) throw new Error('Jesteś już na liście uczestników.');
      const problem = await eligibility(interaction.guild, item, interaction.user.id);
      if (problem) throw new Error(problem);
      // The status may have changed while fetching the member: check again in SQL.
      const inserted = db.prepare(`INSERT OR IGNORE INTO giveaway_entries(giveaway_id,user_id,joined_at)
        SELECT id,?,? FROM giveaways WHERE id=? AND status='open' AND ends_at>?`).run(interaction.user.id, Date.now(), id, Date.now());
      if (!inserted.changes) throw new Error('Zapisy właśnie się zakończyły lub zgłoszenie już istnieje.');
      await interaction.editReply({ content: '🎉 Dołączono! Wymagania zostaną sprawdzone ponownie podczas losowania.' });
    } else if (action === 'leave') {
      db.prepare("DELETE FROM giveaway_entries WHERE giveaway_id=? AND user_id=? AND EXISTS(SELECT 1 FROM giveaways WHERE id=? AND status='open' AND ends_at>?)")
        .run(id, interaction.user.id, id, Date.now());
      await interaction.editReply({ content: 'Wycofano Twoje zgłoszenie.' });
    } else throw new Error('Nieznana akcja giveaway.');
    // Counts are refreshed by the scheduler. This keeps frequent joins from issuing
    // competing edits or overwriting the finished announcement with a stale snapshot.
  } catch (error) {
    console.error('[giveaway interaction]', error);
    await replyError(interaction, safeText(error.message, 1500));
  }
  return true;
}

export function installGiveaways(client) {
  let running = false;
  const sweep = async () => {
    if (running || !client.isReady()) return;
    running = true;
    try {
      const jobs = db.prepare("SELECT * FROM giveaways WHERE guild_id=? AND (status!='finished' OR announced=0) ORDER BY created_at").all(config.guildId);
      for (const pending of jobs) {
        if (locks.has(pending.id)) continue;
        // Other jobs may await REST calls for a while. Re-read before rendering so
        // an intervening manual draw cannot be overwritten by an old open card.
        const item = getGiveaway(pending.id, config.guildId);
        if (!item || (item.status === 'finished' && item.announced)) continue;
        try {
          if (item.status === 'publishing') {
            locks.add(item.id);
            try { await publishGiveaway(client, item); } finally { locks.delete(item.id); }
          } else if (item.status === 'drawing' || (item.status === 'open' && item.ends_at <= Date.now())) {
            await drawGiveaway(client, item.id);
          } else {
            locks.add(item.id);
            try {
              await updateAnnouncement(client, item, item.status === 'finished');
              if (item.status === 'finished') db.prepare('UPDATE giveaways SET announced=1,last_error=NULL WHERE id=?').run(item.id);
            } finally { locks.delete(item.id); }
          }
        } catch (error) {
          db.prepare('UPDATE giveaways SET last_error=? WHERE id=?').run(safeText(error.message, 1000), item.id);
          console.error('[giveaway scheduler retry]', item.id, error);
        }
      }
    } finally { running = false; }
  };
  const tick = () => sweep().catch(error => console.error('[giveaway scheduler]', error));
  const timer = setInterval(tick, 30_000);
  timer.unref();
  tick();
  return { stop() { clearInterval(timer); } };
}
