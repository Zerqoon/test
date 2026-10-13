import { randomUUID } from 'node:crypto';
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Events, MessageFlags,
  ModalBuilder, PermissionFlagsBits as P, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder,
} from 'discord.js';
import { config } from './config.js';
import { db } from './db.js';
import { embed, replyError, staffTier, isBotOwner } from './shared.js';
import { logEvent } from './logging.js';
import { canClaimVoice, createSerialQueue, normalizeChannelName, parseVoiceLimit, planOverwrites } from './voice-policy.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS temporary_voice (
    channel_id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, owner_id TEXT NOT NULL,
    panel_id TEXT, base_overwrites TEXT NOT NULL, allowed_ids TEXT NOT NULL DEFAULT '[]',
    blocked_ids TEXT NOT NULL DEFAULT '[]', locked INTEGER NOT NULL DEFAULT 0,
    hidden INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
    UNIQUE(guild_id, owner_id)
  );
  CREATE TABLE IF NOT EXISTS voice_creation_intents (
    marker TEXT PRIMARY KEY, guild_id TEXT NOT NULL, owner_id TEXT NOT NULL,
    parent_id TEXT, base_overwrites TEXT NOT NULL, created_at INTEGER NOT NULL
  );
`);

const rows = {
  get: db.prepare('SELECT * FROM temporary_voice WHERE channel_id = ?'),
  own: db.prepare('SELECT * FROM temporary_voice WHERE guild_id = ? AND owner_id = ?'),
  all: db.prepare('SELECT * FROM temporary_voice WHERE guild_id = ?'),
  add: db.prepare('INSERT INTO temporary_voice(channel_id,guild_id,owner_id,base_overwrites,created_at) VALUES (?,?,?,?,?)'),
  remove: db.prepare('DELETE FROM temporary_voice WHERE channel_id = ?'),
  panel: db.prepare('UPDATE temporary_voice SET panel_id = ? WHERE channel_id = ?'),
  access: db.prepare('UPDATE temporary_voice SET allowed_ids = ?, blocked_ids = ?, locked = ?, hidden = ?, owner_id = ? WHERE channel_id = ?'),
  intents: db.prepare('SELECT * FROM voice_creation_intents WHERE guild_id = ?'),
  intent: db.prepare('INSERT INTO voice_creation_intents VALUES (?,?,?,?,?,?)'),
  forgetIntent: db.prepare('DELETE FROM voice_creation_intents WHERE marker = ?'),
};

const serial = createSerialQueue();
const creating = new Set();
const renameCooldown = new Map();
const report = (error) => console.error('[voice]', error);
const unknown = error => error?.code === 10003;
const format = row => ({
  ...row, allowed: JSON.parse(row.allowed_ids), blocked: JSON.parse(row.blocked_ids),
});

async function fetchChannel(guild, id) {
  try { return await guild.channels.fetch(id); } catch (error) { if (unknown(error)) return null; throw error; }
}

function accessPlan(guild, row) {
  return planOverwrites(JSON.parse(row.base_overwrites), {
    guildId: guild.id, ownerId: row.owner_id, botId: guild.client.user.id,
    staffRoleIds: [config.roles.owner, config.roles.admin].filter(id => guild.roles.cache.has(id)),
    staffUserIds: config.ownerIds,
    allowedIds: row.allowed, blockedIds: row.blocked, locked: Boolean(row.locked), hidden: Boolean(row.hidden),
  });
}

function panel(row, channel) {
  const id = channel.id;
  const button = (action, text, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(`voice:${action}:${id}`).setLabel(text).setStyle(style);
  return {
    embeds: [embed('🌙 Twój prywatny kanał', [
      `Właściciel: <@${row.owner_id}>`,
      `**Wejście:** ${row.locked ? '🔒 na zaproszenie' : '🔓 otwarte'} · **Widoczność:** ${row.hidden ? 'ukryty' : 'widoczny'}`,
      `**Limit:** ${channel.userLimit || 'bez limitu'}`,
      '',
      'Właściciel i administracja mogą zmieniać ustawienia poniżej.',
      '„Dopuść osobę” daje dostęp także do zablokowanego i ukrytego kanału.',
      'Gdy właściciel wyjdzie, obecna na kanale osoba może go przejąć.',
      'Pusty kanał jest automatycznie usuwany.',
    ].join('\n'))],
    components: [
      new ActionRowBuilder().addComponents(button('rename', '✏️ Nazwa'), button('limit', '👥 Limit'), button('lock', row.locked ? '🔓 Odblokuj' : '🔒 Zablokuj'), button('hide', row.hidden ? '👁️ Pokaż' : '🌫️ Ukryj')),
      new ActionRowBuilder().addComponents(button('allow', '✅ Dopuść osobę'), button('block', '⛔ Odbierz dostęp'), button('transfer', '👑 Przekaż'), button('claim', '🙋 Przejmij')),
      new ActionRowBuilder().addComponents(button('delete', 'Usuń kanał', ButtonStyle.Danger)),
    ],
    allowedMentions: { parse: [] },
  };
}

async function refreshPanel(channel, row, repair = false) {
  // Also upgrade rooms created before owner IDs were configured, without resetting
  // their other permissions. This runs only for tracked temporary channels.
  const ownerAccess = { ViewChannel: true, Connect: true, Speak: true, SendMessages: true, ReadMessageHistory: true };
  const ownerBits = Object.keys(ownerAccess).map(name => P[name]);
  for (const id of config.ownerIds ?? []) {
    const current = channel.permissionOverwrites.cache.get(id);
    if (!current?.allow.has(ownerBits) || current.deny.any(ownerBits)) {
      await channel.permissionOverwrites.edit(id, ownerAccess, { type: 1, reason: 'Dostęp właściciela bota po ID' });
    }
  }
  let message;
  if (row.panel_id) {
    try { message = await channel.messages.fetch(row.panel_id); }
    catch (error) { if (error?.code !== 10008) throw error; }
  }
  if (message) {
    if (!repair) await message.edit(panel(row, channel));
    return;
  }
  const sent = await channel.send(panel(row, channel));
  rows.panel.run(sent.id, channel.id);
}

async function logVoice(client, title, description) {
  try { await logEvent(client, config.channels.moderation, { title, description }); } catch (error) { report(error); }
}

async function deleteEmpty(guild, channelId) {
  return serial(channelId, async () => {
    const row = rows.get.get(channelId);
    if (!row || row.guild_id !== guild.id || creating.has(channelId)) return;
    const channel = await fetchChannel(guild, channelId);
    if (!channel) { rows.remove.run(channelId); return; }
    if (channel.type !== ChannelType.GuildVoice || channel.members.size > 0) return;
    // The REST move may complete before VoiceStateUpdate populates channel.members.
    // Never tear down a just-created channel in that gateway propagation window.
    if (Date.now() - row.created_at < 15000) return;
    // The database record is deliberately removed only after a successful Discord deletion.
    await channel.delete('Pusty tymczasowy kanał głosowy');
    rows.remove.run(channelId);
    renameCooldown.delete(channelId);
  });
}

async function requireBotPermissions(channel) {
  const me = channel.guild.members.me ?? await channel.guild.members.fetchMe();
  const required = [P.ViewChannel, P.Connect, P.SendMessages, P.EmbedLinks, P.ReadMessageHistory, P.ManageChannels, P.ManageRoles, P.MoveMembers];
  if (!channel.permissionsFor(me)?.has(required)) throw new Error('Bot potrzebuje na kanale: widoczności, łączenia, wysyłania wiadomości i embedów, historii, zarządzania kanałami/uprawnieniami oraz przenoszenia członków.');
}

async function createFor(member) {
  const guild = member.guild;
  await serial(`create:${guild.id}`, async () => {
    if (member.voice.channelId !== config.channels.voiceCreator) return;
    const trigger = await fetchChannel(guild, config.channels.voiceCreator);
    if (!trigger || trigger.type !== ChannelType.GuildVoice) throw new Error('AUTO KANAŁ musi być zwykłym kanałem głosowym.');
    await requireBotPermissions(trigger);
    const owned = rows.own.get(guild.id, member.id);
    if (owned) {
      const previous = await fetchChannel(guild, owned.channel_id);
      if (previous && member.voice.channelId === trigger.id) { await member.voice.setChannel(previous, 'Powrót do własnego kanału'); return; }
      if (!previous) rows.remove.run(owned.channel_id);
    }
    if (rows.all.all(guild.id).length >= (config.voice.maxPerGuild ?? 40)) throw new Error('Osiągnięto limit tymczasowych kanałów. Spróbuj ponownie później.');
    // Save intent BEFORE the remote create. Its random exact name identifies a crash-window channel.
    const marker = `moonlight-pending-${randomUUID()}`;
    const source = trigger.parent ?? trigger;
    const base = source.permissionOverwrites.cache.map(o => ({ id: o.id, type: o.type, allow: o.allow.bitfield.toString(), deny: o.deny.bitfield.toString() }));
    const createdAt = Date.now();
    const initial = { guild_id: guild.id, owner_id: member.id, base_overwrites: JSON.stringify(base), allowed: [], blocked: [], locked: 0, hidden: 0 };
    const overwrites = accessPlan(guild, initial);
    rows.intent.run(marker, guild.id, member.id, trigger.parentId, initial.base_overwrites, createdAt);
    let channel;
    try {
      channel = await guild.channels.create({ name: marker, type: ChannelType.GuildVoice, parent: trigger.parentId, permissionOverwrites: overwrites, reason: `Tymczasowy voice dla ${member.id}` });
      creating.add(channel.id);
      db.exec('BEGIN IMMEDIATE');
      try { rows.add.run(channel.id, guild.id, member.id, initial.base_overwrites, createdAt); rows.forgetIntent.run(marker); db.exec('COMMIT'); }
      catch (error) { db.exec('ROLLBACK'); throw error; }
      await channel.setName(normalizeChannelName(`${config.voice.namePrefix}${member.displayName}`.slice(0, 100)), 'Nazwa prywatnego kanału');
      await refreshPanel(channel, rows.get.get(channel.id));
      if (member.voice.channelId === trigger.id) await member.voice.setChannel(channel, 'Automatyczny kanał po 5 sekundach');
    } catch (error) {
      // Keep the intent on network uncertainty; reconciliation can recover a completed remote create.
      if (channel && !rows.get.get(channel.id)) {
        try { if (channel.members.size === 0) { await channel.delete('Wycofanie nieudanej konfiguracji'); rows.forgetIntent.run(marker); } }
        catch (cleanupError) { report(cleanupError); }
      }
      throw error;
    } finally {
      if (channel) {
        creating.delete(channel.id);
        try { await deleteEmpty(guild, channel.id); } catch (error) { report(error); }
      }
    }
  });
}

async function recoverIntents(guild) {
  const intents = rows.intents.all(guild.id);
  if (!intents.length) return;
  const channels = await guild.channels.fetch();
  for (const intent of intents) {
    // Only a channel recorded by our pre-create journal is eligible; arbitrary channels are never adopted.
    const candidate = channels.find(c => c?.type === ChannelType.GuildVoice && c.name === intent.marker && c.parentId === intent.parent_id && c.createdTimestamp >= intent.created_at - 10000 && c.createdTimestamp <= intent.created_at + 600000 && c.permissionOverwrites.cache.has(guild.client.user.id));
    if (!candidate) {
      if (Date.now() - intent.created_at > 3600000) rows.forgetIntent.run(intent.marker);
      continue;
    }
    if (!rows.get.get(candidate.id)) {
      const existing = rows.own.get(guild.id, intent.owner_id);
      if (existing && existing.channel_id !== candidate.id) {
        if (candidate.members.size === 0) { await candidate.delete('Niedokończone tworzenie kanału po restarcie'); rows.forgetIntent.run(intent.marker); }
        continue;
      }
      rows.add.run(candidate.id, guild.id, intent.owner_id, intent.base_overwrites, intent.created_at);
    }
    rows.forgetIntent.run(intent.marker);
    if (candidate.members.size === 0) await deleteEmpty(guild, candidate.id);
    else {
      await candidate.setName(`${config.voice.namePrefix}odzyskany-kanał`.slice(0, 100));
      await refreshPanel(candidate, rows.get.get(candidate.id));
    }
  }
}

export function installVoice(client) {
  const pending = new Map();
  let stopped = false;
  let reconciling = false;
  function schedule(member) {
    if (stopped || member.user.bot || pending.has(member.id)) return;
    const timer = setTimeout(() => {
      pending.delete(member.id);
      if (stopped || member.voice.channelId !== config.channels.voiceCreator) return;
      createFor(member).catch(async error => {
        report(error);
        await logVoice(client, '⚠️ Nie udało się utworzyć voice', `Użytkownik: ${member.id}\n${String(error.message).slice(0, 1500)}`);
        member.send({ content: `Nie udało się utworzyć Twojego kanału. Administracja otrzymała informację. Wyjdź z AUTO KANAŁU i wejdź ponownie.`, allowedMentions: { parse: [] } }).catch(() => {});
      });
    }, Math.max(5000, config.voice.createDelayMs ?? 5000));
    timer.unref();
    pending.set(member.id, timer);
  }
  const onState = (before, after) => {
    if (after.guild.id !== config.guildId || before.channelId === after.channelId) return;
    const timer = pending.get(after.id);
    if (timer) { clearTimeout(timer); pending.delete(after.id); }
    if (before.channelId) deleteEmpty(after.guild, before.channelId).catch(report);
    if (after.channelId === config.channels.voiceCreator && after.member) schedule(after.member);
  };
  const reconcile = async () => {
    if (stopped || reconciling || !client.isReady()) return;
    reconciling = true;
    try {
      const guild = client.guilds.cache.get(config.guildId);
      if (!guild) return;
      // Serialize with creation so an intent cannot be recovered while its request is still running.
      await serial(`create:${guild.id}`, () => recoverIntents(guild));
      for (const row of rows.all.all(guild.id)) {
        try {
          if (creating.has(row.channel_id)) continue;
          const channel = await fetchChannel(guild, row.channel_id);
          if (!channel) { rows.remove.run(row.channel_id); continue; }
          if (channel.type !== ChannelType.GuildVoice) continue;
          if (channel.members.size === 0) await deleteEmpty(guild, channel.id);
          else await serial(channel.id, async () => { const latest = rows.get.get(channel.id); if (latest) await refreshPanel(channel, latest, true); });
        } catch (error) { report(error); }
      }
      const trigger = await fetchChannel(guild, config.channels.voiceCreator);
      if (trigger?.type === ChannelType.GuildVoice) for (const member of trigger.members.values()) schedule(member);
    } finally { reconciling = false; }
  };
  const onReady = () => reconcile().catch(report);
  client.on(Events.VoiceStateUpdate, onState);
  client.on(Events.ClientReady, onReady);
  const interval = setInterval(() => reconcile().catch(report), 60000);
  interval.unref();
  if (client.isReady()) onReady();
  return { stop() { stopped = true; clearInterval(interval); for (const timer of pending.values()) clearTimeout(timer); pending.clear(); client.off(Events.VoiceStateUpdate, onState); client.off(Events.ClientReady, onReady); } };
}

async function authorize(interaction, id, action) {
  if (!interaction.inGuild() || interaction.guildId !== config.guildId) throw new Error('Ten panel działa tylko na skonfigurowanym serwerze.');
  const row = rows.get.get(id);
  if (!row || row.guild_id !== interaction.guildId) throw new Error('Ten kanał już nie jest aktywny.');
  const channel = await fetchChannel(interaction.guild, id);
  if (!channel || channel.type !== ChannelType.GuildVoice) throw new Error('Kanał nie istnieje.');
  const member = await interaction.guild.members.fetch({ user: interaction.user.id, force: true });
  const manager = row.owner_id === member.id || staffTier(member) >= 2;
  if (!manager && action !== 'claim') throw new Error('Tylko właściciel kanału i administracja mogą używać tych ustawień.');
  if (action === 'claim' && !canClaimVoice(row, member, channel)) throw new Error('Możesz przejąć kanał, gdy jesteś na nim, a dotychczasowy właściciel wyszedł.');
  return { row: format(row), channel, member };
}

async function saveAccess(channel, next) {
  const old = format(rows.get.get(channel.id));
  await channel.permissionOverwrites.set(accessPlan(channel.guild, next), 'Panel właściciela kanału');
  try { rows.access.run(JSON.stringify(next.allowed), JSON.stringify(next.blocked), Number(Boolean(next.locked)), Number(Boolean(next.hidden)), next.owner_id, channel.id); }
  catch (error) {
    try { await channel.permissionOverwrites.set(accessPlan(channel.guild, old), 'Przywrócenie ustawień po błędzie zapisu'); } catch (rollbackError) { report(rollbackError); }
    throw error;
  }
}

function assertTarget(actor, target, ownerId) {
  if (target.id === ownerId || target.id === actor.id) throw new Error('Nie możesz odebrać dostępu właścicielowi ani sobie.');
  if (target.user.bot || target.id === target.guild.ownerId || isBotOwner(target)) throw new Error('Nie możesz odebrać dostępu botowi ani właścicielowi bota lub serwera.');
  if (staffTier(target) > 0 && staffTier(actor) <= staffTier(target)) throw new Error('Nie możesz odebrać dostępu osobie o równym lub wyższym poziomie administracyjnym.');
  if (!isBotOwner(actor) && actor.id !== actor.guild.ownerId && target.roles.highest.position >= actor.roles.highest.position) throw new Error('Nie możesz odebrać dostępu osobie z równą lub wyższą rolą.');
  if (target.voice.channelId && !target.manageable) throw new Error('Rola bota musi znajdować się ponad najwyższą rolą tej osoby.');
}

async function runAction(interaction, action, id) {
  const { row, channel, member } = await authorize(interaction, id, action);
  const reason = `Panel voice: ${interaction.user.id}`;
  if (action === 'rename' || action === 'limit') {
    const field = new TextInputBuilder().setCustomId('value').setStyle(TextInputStyle.Short).setRequired(true);
    if (action === 'rename') field.setLabel('Nowa nazwa kanału').setMaxLength(100).setValue(channel.name);
    else field.setLabel('Limit 0–99 (0 = bez limitu)').setMaxLength(2).setValue(String(channel.userLimit));
    await interaction.showModal(new ModalBuilder().setCustomId(`voice:${action}_submit:${id}`).setTitle(action === 'rename' ? 'Zmień nazwę' : 'Zmień limit osób').addComponents(new ActionRowBuilder().addComponents(field)));
    return;
  }
  if (['allow', 'block', 'transfer'].includes(action)) {
    await interaction.editReply({ content: action === 'transfer' ? 'Wybierz nowego właściciela, który jest teraz na kanale.' : 'Wybierz użytkownika z serwera.', components: [new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`voice:${action}_select:${id}`).setPlaceholder('Wybierz użytkownika').setMinValues(1).setMaxValues(1))] });
    return;
  }
  if (action === 'delete') {
    await interaction.editReply({ content: 'Usunąć ten kanał? Możesz to zrobić, kiedy kanał jest pusty lub jesteś na nim sam.', components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`voice:delete_confirm:${id}`).setLabel('Potwierdzam usunięcie').setStyle(ButtonStyle.Danger))] });
    return;
  }
  await requireBotPermissions(channel);
  if (action === 'rename_submit') {
    const until = renameCooldown.get(id) ?? 0;
    if (until > Date.now()) throw new Error('Nazwę można zmieniać raz na 5 minut. Poczekaj chwilę.');
    const name = normalizeChannelName(interaction.fields.getTextInputValue('value'));
    await channel.setName(name, reason);
    renameCooldown.set(id, Date.now() + 300000);
  } else if (action === 'limit_submit') {
    await channel.setUserLimit(parseVoiceLimit(interaction.fields.getTextInputValue('value')), reason);
  } else if (action === 'lock' || action === 'hide') {
    if (action === 'lock') row.locked = !row.locked;
    else row.hidden = !row.hidden;
    await saveAccess(channel, row);
  } else if (action === 'claim') {
    if (rows.own.get(interaction.guildId, member.id)) throw new Error('Masz już własny kanał. Najpierw go opuść i poczekaj na usunięcie.');
    row.owner_id = member.id;
    row.allowed = row.allowed.filter(value => value !== member.id);
    row.blocked = row.blocked.filter(value => value !== member.id);
    await saveAccess(channel, row);
  } else if (action.endsWith('_select')) {
    const target = await interaction.guild.members.fetch({ user: interaction.values[0], force: true });
    if (action === 'transfer_select') {
      if (target.user.bot || target.voice.channelId !== id) throw new Error('Nowy właściciel musi być człowiekiem obecnym na tym kanale.');
      if (target.id === row.owner_id || rows.own.get(interaction.guildId, target.id)) throw new Error('Ta osoba już posiada kanał.');
      row.owner_id = target.id;
      row.allowed = row.allowed.filter(value => value !== target.id);
      row.blocked = row.blocked.filter(value => value !== target.id);
    } else if (action === 'allow_select') {
      row.allowed = [...new Set([...row.allowed, target.id])];
      row.blocked = row.blocked.filter(value => value !== target.id);
    } else if (action === 'block_select') {
      assertTarget(member, target, row.owner_id);
      row.blocked = [...new Set([...row.blocked, target.id])];
      row.allowed = row.allowed.filter(value => value !== target.id);
    } else throw new Error('Nieznana operacja panelu.');
    await saveAccess(channel, row);
    if (action === 'block_select' && target.voice.channelId === id) {
      try { await target.voice.disconnect(reason); }
      catch (error) { throw new Error('Dostęp odebrany, ale nie udało się rozłączyć użytkownika. Sprawdź uprawnienia bota.'); }
    }
  } else if (action === 'delete_confirm') {
    if ([...channel.members.values()].some(user => user.id !== member.id)) throw new Error('Na kanale są inne osoby. Usuń go, kiedy wyjdą.');
    await channel.delete(reason);
    rows.remove.run(id);
    renameCooldown.delete(id);
    await interaction.editReply({ content: 'Kanał został usunięty.', components: [] });
    await logVoice(interaction.client, '🗑️ Usunięto tymczasowy voice', `Kanał: ${id}\nWykonawca: ${member.id}`);
    return;
  } else throw new Error('Nieznana operacja panelu.');
  const updated = rows.get.get(id);
  if (updated) await refreshPanel(channel, updated);
  await interaction.editReply({ content: '✅ Zapisano ustawienia kanału.', components: [] });
  await logVoice(interaction.client, '🔊 Zmiana tymczasowego voice', `Kanał: <#${id}> (${id})\nWykonawca: ${member.id}\nOperacja: ${action}`);
}

export async function handleVoiceInteraction(interaction) {
  if (!interaction.customId?.startsWith('voice:')) return false;
  try {
    const match = /^voice:([a-z_]+):(\d{17,20})$/.exec(interaction.customId);
    if (!match) throw new Error('Nieprawidłowy panel kanału.');
    const [, action, id] = match;
    // Modal-opening buttons must respond with a modal, not defer first.
    if (action === 'rename' || action === 'limit') await runAction(interaction, action, id);
    else {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await serial(id, () => runAction(interaction, action, id));
    }
  } catch (error) {
    report(error);
    try { await replyError(interaction, error.message?.slice(0, 1800) || 'Nie udało się zmienić ustawień kanału.'); } catch (replyFailure) { report(replyFailure); }
  }
  return true;
}
