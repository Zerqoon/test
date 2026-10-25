import { ChannelType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { config } from './config.js';
import { db } from './db.js';
import { canModerate, embed, isBotOwner, replyError, safeText, staffTier } from './shared.js';
import { logEvent } from './logging.js';

db.exec(`CREATE TABLE IF NOT EXISTS warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, user_id TEXT NOT NULL,
  moderator_id TEXT NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL,
  revoked_at INTEGER, revoked_by TEXT, revoke_reason TEXT
); CREATE INDEX IF NOT EXISTS warnings_user ON warnings(guild_id,user_id,revoked_at);`);

const command = (name, description) => new SlashCommandBuilder().setName(name).setDescription(description).setDMPermission(false);
const person = o => o.setName('osoba').setDescription('Użytkownik').setRequired(true);
const reason = o => o.setName('powod').setDescription('Powód działania').setMaxLength(350).setRequired(true);
const textTypes = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
export const extraModerationCommands = [
  command('kick', 'Wyrzuć osobę z serwera (Admin i Owner)').addUserOption(person).addStringOption(reason),
  command('clear', 'Usuń wiadomości z ostatnich 100, młodsze niż 14 dni; pomija przypięte')
    .addIntegerOption(o => o.setName('ilosc').setDescription('Maksymalnie tyle wiadomości usunąć').setMinValue(1).setMaxValue(100).setRequired(true))
    .addUserOption(o => o.setName('osoba').setDescription('Usuń tylko wiadomości tej osoby')),
  command('slowmode', 'Ustaw opóźnienie między wiadomościami (Admin i Owner)')
    .addIntegerOption(o => o.setName('sekundy').setDescription('0 wyłącza slowmode; maksimum 21600 s').setMinValue(0).setMaxValue(21600).setRequired(true))
    .addChannelOption(o => o.setName('kanal').setDescription('Domyślnie bieżący kanał tekstowy').addChannelTypes(...textTypes)),
  command('warn', 'Zapisz ostrzeżenie; bez automatycznej kary (Moderator i wyżej)').addUserOption(person).addStringOption(reason),
  command('warny', 'Sprawdź własne ostrzeżenia; Moderator może sprawdzać wszystkich')
    .addUserOption(o => o.setName('osoba').setDescription('Domyślnie Twoje konto')),
  command('unwarn', 'Cofnij ostrzeżenie po numerze (Admin i Owner)')
    .addIntegerOption(o => o.setName('id').setDescription('Numer ostrzeżenia z /warny').setMinValue(1).setRequired(true)).addStringOption(reason),
  command('nick', 'Zmień lub wyczyść pseudonim osoby (Admin i Owner)').addUserOption(person).addStringOption(reason)
    .addStringOption(o => o.setName('nazwa').setDescription('Nowy pseudonim; brak = usuń pseudonim').setMinLength(1).setMaxLength(32)),
];

async function audit(i, title, description) {
  try {
    await logEvent(i.client, config.channels.actions || config.channels.moderation, { title, description,
      fields: [{ name: 'Moderator', value: `${i.user.username ?? 'Użytkownik'} • ${i.user.id}` }] });
  } catch (error) { console.error('[extra moderation log]', error); }
}

async function actorFor(i, minimum = 1) {
  const actor = await i.guild.members.fetch({ user: i.user.id, force: true });
  if (staffTier(actor) < minimum) throw new Error(minimum === 1
    ? 'Ta komenda wymaga roli Moderator, Admin lub Owner (właściciel bota również ma dostęp).'
    : 'Ta komenda wymaga roli Admin lub Owner (właściciel bota również ma dostęp).');
  return actor;
}

async function targetFor(i, actor, minimum, permission) {
  const user = i.options.getUser('osoba', true);
  const target = await i.guild.members.fetch({ user: user.id, force: true });
  if (!canModerate(actor, target, minimum)) throw new Error('Ta osoba jest chroniona poziomem uprawnień lub hierarchią ról.');
  if (permission) {
    const bot = await i.guild.members.fetchMe();
    if (!bot.permissions.has(permission)) throw new Error('Bot nie ma wymaganego uprawnienia Discord do tej akcji.');
    if (bot.roles.highest.comparePositionTo(target.roles.highest) <= 0) throw new Error('Przenieś rolę bota nad najwyższą rolę tej osoby.');
  }
  return target;
}

async function channelFor(i, actor, permission, history = false) {
  const selected = i.options.getChannel('kanal') ?? i.channel;
  if (!selected || selected.guildId !== i.guildId || !textTypes.includes(selected.type)) throw new Error('Wybierz zwykły kanał tekstowy lub kanał ogłoszeń na tym serwerze.');
  // Re-fetch to avoid stale overwrites in cached interaction channel data.
  const channel = await i.guild.channels.fetch(selected.id, { force: true });
  if (!channel || !textTypes.includes(channel.type)) throw new Error('Ten kanał nie jest już dostępny.');
  if (!isBotOwner(actor) && !channel.permissionsFor(actor)?.has(PermissionFlagsBits.ViewChannel)) throw new Error('Nie masz dostępu do tego kanału.');
  const bot = await i.guild.members.fetchMe();
  const required = [PermissionFlagsBits.ViewChannel, permission];
  if (history) required.push(PermissionFlagsBits.ReadMessageHistory);
  if (!channel.permissionsFor(bot)?.has(required)) throw new Error('Bot nie ma wymaganych uprawnień na tym kanale (widoczność, zarządzanie oraz historia dla /clear).');
  return channel;
}

export async function handleExtraModeration(i) {
  if (!i.isChatInputCommand() || !extraModerationCommands.some(c => c.name === i.commandName)) return false;
  try {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    if (!i.guild) throw new Error('Tej komendy użyj na serwerze.');
    if (i.commandName === 'warny') {
      const user = i.options.getUser('osoba') ?? i.user;
      const actor = await i.guild.members.fetch({ user: i.user.id, force: true });
      if (user.id !== actor.id && staffTier(actor) < 1) throw new Error('Możesz sprawdzić tylko własne ostrzeżenia. Moderator i wyżej może sprawdzać inne osoby.');
      const rows = db.prepare('SELECT * FROM warnings WHERE guild_id=? AND user_id=? AND revoked_at IS NULL ORDER BY id DESC LIMIT 10').all(i.guildId, user.id);
      const total = db.prepare('SELECT COUNT(*) AS count FROM warnings WHERE guild_id=? AND user_id=? AND revoked_at IS NULL').get(i.guildId, user.id).count;
      const card = embed('⚠️ Ostrzeżenia', `Użytkownik: <@${user.id}> • ${user.id}\nAktywne ostrzeżenia: **${total}**${total > 10 ? '\nWyświetlono 10 najnowszych.' : ''}\nOstrzeżenia nie uruchamiają automatycznych kar.`);
      for (const row of rows) card.addFields({ name: `#${row.id}`, value: safeText(`${row.reason}\nModerator: ${row.moderator_id} • <t:${Math.floor(row.created_at / 1000)}:f>`, 500) });
      await i.editReply({ embeds: [card], allowedMentions: { parse: [] } });
      return true;
    }
    const minimum = ['clear', 'warn'].includes(i.commandName) ? 1 : 2;
    const actor = await actorFor(i, minimum);
    if (i.commandName === 'clear') {
      const channel = await channelFor(i, actor, PermissionFlagsBits.ManageMessages, true);
      const amount = i.options.getInteger('ilosc', true);
      if (!Number.isInteger(amount) || amount < 1 || amount > 100) throw new Error('Liczba wiadomości musi mieścić się w zakresie 1–100.');
      const user = i.options.getUser('osoba');
      const fetched = await channel.messages.fetch({ limit: 100 });
      const oldest = Date.now() - 14 * 86_400_000;
      const selected = [...fetched.values()].sort((a, b) => b.createdTimestamp - a.createdTimestamp)
        .filter(m => !m.pinned && m.createdTimestamp > oldest && (!user || m.author?.id === user.id)).slice(0, amount);
      // Discord.js checks the age once more immediately before the REST request.
      const removed = selected.length ? (await channel.bulkDelete(selected, true)).size : 0;
      const text = `Usunięto **${removed}** wiadomości na <#${channel.id}> (żądano maks. ${amount}).\nSprawdzono ostatnie ${fetched.size} wiadomości; przypięte i starsze niż 14 dni pominięto.${user ? `\nFiltr autora: ${user.id}.` : ''}`;
      await i.editReply({ content: text, allowedMentions: { parse: [] } });
      if (removed) await audit(i, '🧹 Usunięto wiadomości', text);
      return true;
    }
    if (i.commandName === 'slowmode') {
      const channel = await channelFor(i, actor, PermissionFlagsBits.ManageChannels);
      const seconds = i.options.getInteger('sekundy', true);
      if (!Number.isInteger(seconds) || seconds < 0 || seconds > 21600) throw new Error('Slowmode musi mieścić się w zakresie 0–21600 sekund.');
      await channel.setRateLimitPerUser(seconds, `Slowmode • moderator ${actor.id}`);
      const text = `<#${channel.id}> • ${seconds ? `Slowmode: **${seconds} s**` : 'Slowmode wyłączony.'}`;
      await i.editReply({ content: text, allowedMentions: { parse: [] } });
      await audit(i, '⏳ Zmieniono slowmode', text);
      return true;
    }
    const reasonText = i.options.getString('powod', true).trim();
    if (!reasonText) throw new Error('Podaj powód działania.');
    if (i.commandName === 'unwarn') {
      const id = i.options.getInteger('id', true);
      const row = db.prepare('SELECT * FROM warnings WHERE id=? AND guild_id=?').get(id, i.guildId);
      if (!row || row.revoked_at !== null) throw new Error('Nie znaleziono aktywnego ostrzeżenia o tym numerze na tym serwerze.');
      if (row.user_id === actor.id || isBotOwner(row.user_id) || row.user_id === i.guild.ownerId) throw new Error('Nie możesz cofnąć ostrzeżenia sobie ani chronionemu właścicielowi.');
      let target;
      try { target = await i.guild.members.fetch({ user: row.user_id, force: true }); }
      catch (error) { if (error.code !== 10007) throw error; }
      if (target && !canModerate(actor, target, 2)) throw new Error('Ta osoba jest chroniona poziomem uprawnień lub hierarchią ról.');
      const result = db.prepare('UPDATE warnings SET revoked_at=?,revoked_by=?,revoke_reason=? WHERE id=? AND guild_id=? AND revoked_at IS NULL')
        .run(Date.now(), actor.id, reasonText, id, i.guildId);
      if (!result.changes) throw new Error('To ostrzeżenie zostało już cofnięte.');
      const text = `Cofnięto ostrzeżenie **#${id}** użytkownika ${row.user_id}.\nPowód: ${reasonText}`;
      await i.editReply({ content: text, allowedMentions: { parse: [] } });
      await audit(i, '✅ Cofnięto ostrzeżenie', text);
      return true;
    }
    const permission = i.commandName === 'kick' ? PermissionFlagsBits.KickMembers : i.commandName === 'nick' ? PermissionFlagsBits.ManageNicknames : null;
    const target = await targetFor(i, actor, minimum, permission);
    const auditReason = safeText(`${reasonText} • moderator ${actor.id}`, 480);
    let title;
    let detail = '';
    if (i.commandName === 'kick') {
      if (!target.kickable) throw new Error('Discord nie pozwala botowi wyrzucić tej osoby. Sprawdź hierarchię ról.');
      await target.kick(auditReason);
      title = '👢 Wyrzucono z serwera';
    } else if (i.commandName === 'nick') {
      if (!target.manageable) throw new Error('Discord nie pozwala botowi zmienić pseudonimu tej osoby. Sprawdź hierarchię ról.');
      const name = i.options.getString('nazwa')?.trim() || null;
      await target.setNickname(name, auditReason);
      title = '✏️ Zmieniono pseudonim';
      detail = `\nNowy pseudonim: ${name ?? '(usunięty)'}`;
    } else {
      const result = db.prepare('INSERT INTO warnings(guild_id,user_id,moderator_id,reason,created_at) VALUES(?,?,?,?,?)')
        .run(i.guildId, target.id, actor.id, reasonText, Date.now());
      title = '⚠️ Zapisano ostrzeżenie';
      detail = `\nNumer: **#${result.lastInsertRowid}** • Bez automatycznej kary.`;
    }
    const description = `<@${target.id}> • ID: ${target.id}\nPowód: ${reasonText}${detail}`;
    await i.editReply({ embeds: [embed(title, description)], allowedMentions: { parse: [] } });
    await audit(i, title, description);
  } catch (error) {
    console.error('[extra moderation]', i.commandName, error);
    await replyError(i, error.code === 10007 ? 'Ta osoba nie jest na serwerze.' : safeText(error.message, 1500));
  }
  return true;
}
