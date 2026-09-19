import {
  AttachmentBuilder,
  AuditLogEvent,
  EmbedBuilder,
  PermissionsBitField,
} from 'discord.js';
import { config } from './config.js';
import { userForCard, welcomeCard } from './cards.js';

const LOG_CHANNELS = {
  message: () => config.channels.messageLog,
  voice: () => config.channels.voiceLog,
  account: () => config.channels.accountLog,
  change: () => config.channels.changeLog,
};

// Spójna paleta pod ciemny / biało-fioletowy serwer.
const COLORS = {
  message: 0xB56CFF,
  voice: 0x8B5CF6,
  account: 0xC4B5FD,
  change: 0xA855F7,
};

const ICONS = {
  message: '💬',
  voice: '🔊',
  account: '👤',
  change: '🛡️',
};

const auditUse = new Map();
const MAX_FIELD_VALUE = 1024;
const MAX_FIELDS = 25;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const toMs = value => {
  if (value instanceof Date) return value.getTime();
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Date.now();
};

const stamp = (value = Date.now(), style = 'F') =>
  `<t:${Math.floor(toMs(value) / 1000)}:${style}>`;

const clean = value => {
  if (value === null || value === undefined || value === '') return '—';
  return String(value)
    .replace(/```/g, '`\u200b``')
    .replace(/@everyone/g, '@\u200beveryone')
    .replace(/@here/g, '@\u200bhere');
};

const clip = (value, max = 900) => {
  const output = clean(value);
  if (output.length <= max) return output;
  return `${output.slice(0, Math.max(0, max - 1))}…`;
};

const who = id => (id ? `<@${id}>` : 'Nieznany');
const roleMention = id => (id ? `<@&${id}>` : 'Nieznana rola');
const channelMention = id => (id ? `<#${id}>` : 'Nieznany kanał');

const parseAttachmentNames = raw => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
  } catch {
    return [String(raw)];
  }
};

const currentAttachmentNames = message =>
  [...(message.attachments?.values?.() ?? [])].map(attachment => attachment.name || attachment.url);

const listWithOverflow = (items, limit = 12) => {
  if (!items.length) return '—';
  const visible = items.slice(0, limit);
  const overflow = items.length - visible.length;
  return `${visible.join(', ')}${overflow > 0 ? `\n… i jeszcze ${overflow}` : ''}`;
};

const normalizeField = field => {
  const [name, value, inline = false] = field;
  return {
    name: clip(name, 256),
    value: clip(value, MAX_FIELD_VALUE),
    inline: Boolean(inline),
  };
};

async function resolveLogChannel(guild, kind) {
  const getter = LOG_CHANNELS[kind];
  const channelId = getter?.();
  if (!channelId) return null;

  const channel = guild.channels.cache.get(channelId)
    ?? await guild.channels.fetch(channelId).catch(() => null);

  if (!channel?.isTextBased?.() || typeof channel.send !== 'function') return null;
  return channel;
}

/**
 * Wspólny renderer logów. Nie pingujemy użytkowników z logów.
 * Pola wejściowe: [nazwa, wartość, inline?]
 */
async function sendLog(
  guild,
  kind,
  title,
  fields = [],
  {
    description = '',
    image = null,
    imageName = 'log-image.png',
    thumbnail = null,
    files = [],
    footer = null,
  } = {},
) {
  const channel = await resolveLogChannel(guild, kind);
  if (!channel) return false;

  const brand = config.brand?.name || guild.name || 'Discord';
  const guildIcon = guild.iconURL?.({ extension: 'png', size: 128 }) || undefined;
  const normalizedFields = fields.slice(0, MAX_FIELDS).map(normalizeField);

  const embed = new EmbedBuilder()
    .setColor(COLORS[kind] ?? COLORS.change)
    .setAuthor({ name: `${brand} • LOGI`, ...(guildIcon ? { iconURL: guildIcon } : {}) })
    .setTitle(`${ICONS[kind] ?? '•'} ${clip(title, 240)}`)
    .setTimestamp()
    .setFooter({
      text: footer || `${kind.toUpperCase()} • ${guild.id}`,
    });

  if (description) embed.setDescription(clip(description, 3800));
  if (normalizedFields.length) embed.addFields(normalizedFields);
  if (thumbnail) embed.setThumbnail(thumbnail);

  const attachments = [...files];
  if (image) {
    attachments.push(new AttachmentBuilder(image, { name: imageName }));
    embed.setImage(`attachment://${imageName}`);
  }

  try {
    await channel.send({
      embeds: [embed],
      files: attachments,
      allowedMentions: { parse: [] },
    });
    return true;
  } catch (error) {
    console.warn(`[logs:${kind}] ${title}:`, error?.message || error);
    return false;
  }
}

function canReadAudit(guild) {
  return Boolean(
    guild.members.me?.permissions.has(PermissionsBitField.Flags.ViewAuditLog),
  );
}

async function recentAuditEntry(guild, type, targetId, predicate = null, maxAge = 8_000) {
  if (!targetId || !canReadAudit(guild)) return null;

  try {
    const logs = await guild.fetchAuditLogs({ type, limit: 8 });
    for (const entry of logs.entries.values()) {
      const age = Date.now() - entry.createdTimestamp;
      if (age < 0 || age > maxAge) continue;
      if (entry.targetId !== targetId) continue;
      if (predicate && !predicate(entry)) continue;
      return entry;
    }
  } catch (error) {
    console.warn(`[logs:audit] ${String(type)}:`, error?.message || error);
  }

  return null;
}

export async function logMessageCreate(message, store) {
  if (message.guildId !== config.guildId || message.author?.bot) return;
  store.saveMessage(message);
}

export async function logMessageEdit(oldMessage, newMessage, store) {
  if (newMessage.guildId !== config.guildId) return;

  if (newMessage.partial) {
    await newMessage.fetch().catch(() => null);
  }
  if (newMessage.author?.bot) return;

  const snapshot = store.snapshot(newMessage.id);
  const beforeContent = snapshot?.content
    ?? (!oldMessage.partial ? oldMessage.content : 'Treść sprzed edycji była poza pamięcią bota');
  const afterContent = newMessage.content ?? '';

  const beforeAttachments = parseAttachmentNames(snapshot?.attachment_names);
  const afterAttachments = currentAttachmentNames(newMessage);

  const contentChanged = beforeContent !== afterContent;
  const attachmentsChanged = beforeAttachments.join('\n') !== afterAttachments.join('\n');

  if (!contentChanged && !attachmentsChanged) {
    if (newMessage.author) store.saveMessage(newMessage);
    return;
  }

  if (newMessage.author) store.saveMessage(newMessage);

  const fields = [
    ['Autor', `${who(newMessage.author?.id || snapshot?.author_id)} • \`${newMessage.author?.id || snapshot?.author_id || 'brak ID'}\``, true],
    ['Kanał', channelMention(newMessage.channelId), true],
    ['Czas', `${stamp(Date.now())}\n${stamp(Date.now(), 'R')}`, true],
  ];

  if (contentChanged) {
    fields.push(
      ['Treść przed', beforeContent || '(pusta treść)'],
      ['Treść po', afterContent || '(pusta treść)'],
    );
  }

  if (attachmentsChanged) {
    fields.push(
      ['Załączniki przed', beforeAttachments.length ? listWithOverflow(beforeAttachments) : '(brak)'],
      ['Załączniki po', afterAttachments.length ? listWithOverflow(afterAttachments) : '(brak)'],
    );
  }

  fields.push(['Wiadomość', `[Przejdź do wiadomości](${newMessage.url}) • \`${newMessage.id}\``]);

  await sendLog(newMessage.guild, 'message', 'Edytowano wiadomość', fields, {
    thumbnail: newMessage.author?.displayAvatarURL?.({ extension: 'png', size: 128 }) || null,
  });
}

async function deletionActor(guild, authorId, channelId) {
  if (!authorId || !canReadAudit(guild)) return null;

  // Audit Log potrafi pojawić się z małym opóźnieniem.
  await sleep(850);

  try {
    const logs = await guild.fetchAuditLogs({
      type: AuditLogEvent.MessageDelete,
      limit: 8,
    });

    for (const entry of logs.entries.values()) {
      const age = Date.now() - entry.createdTimestamp;
      const auditChannelId = entry.extra?.channel?.id ?? entry.extra?.channelId;

      if (age < 0 || age > 8_000) continue;
      if (entry.targetId !== authorId) continue;
      if (auditChannelId && auditChannelId !== channelId) continue;

      const alreadyUsed = auditUse.get(entry.id) || 0;
      const count = Number(entry.extra?.count || 1);
      if (alreadyUsed >= count) continue;

      auditUse.set(entry.id, alreadyUsed + 1);
      if (auditUse.size > 1_500) auditUse.clear();
      return entry.executorId || null;
    }
  } catch (error) {
    console.warn('[logs:message-delete] Audit log:', error?.message || error);
  }

  return null;
}

export async function logMessageDelete(message, store) {
  if (message.guildId !== config.guildId) return;

  const snapshot = store.snapshot(message.id);
  store.removeMessage(message.id);

  if (message.author?.bot) return;

  const authorId = snapshot?.author_id || message.author?.id;
  const actorId = await deletionActor(message.guild, authorId, message.channelId);
  const attachments = parseAttachmentNames(snapshot?.attachment_names);

  await sendLog(message.guild, 'message', 'Usunięto wiadomość', [
    ['Autor', `${who(authorId)}${authorId ? ` • \`${authorId}\`` : ''}`, true],
    [
      'Usunął',
      actorId
        ? `${who(actorId)} • \`${actorId}\``
        : 'Autor wiadomości lub brak jednoznacznego wpisu w Audit Logu',
      true,
    ],
    ['Kanał', channelMention(message.channelId), true],
    [
      'Treść',
      snapshot
        ? (snapshot.content || '(brak treści tekstowej)')
        : 'Niedostępna — bot nie miał snapshotu tej wiadomości.',
    ],
    ...(attachments.length ? [['Załączniki', listWithOverflow(attachments, 15)]] : []),
    ['ID / czas', `\`${message.id}\` • ${stamp(Date.now())} • ${stamp(Date.now(), 'R')}`],
  ], {
    description: snapshot
      ? 'Snapshot wiadomości znaleziony w pamięci bota.'
      : 'Treść mogła powstać przed uruchomieniem bota albo po wygaśnięciu snapshotu.',
    thumbnail: message.author?.displayAvatarURL?.({ extension: 'png', size: 128 }) || null,
  });
}

export async function logBulkDelete(messages, store) {
  const first = messages.first();
  if (!first || first.guildId !== config.guildId) return;

  const rows = [];

  for (const message of messages.values()) {
    const snapshot = store.snapshot(message.id);
    const authorId = snapshot?.author_id || message.author?.id || 'nieznany';
    const content = snapshot?.content || message.content || '(brak treści tekstowej)';
    const attachments = parseAttachmentNames(snapshot?.attachment_names);

    rows.push([
      `[${new Date(message.createdTimestamp || Date.now()).toISOString()}]`,
      `Autor: ${authorId}`,
      `ID: ${message.id}`,
      `Treść: ${content}`,
      attachments.length ? `Załączniki: ${attachments.join(', ')}` : null,
    ].filter(Boolean).join(' | '));

    store.removeMessage(message.id);
  }

  const transcript = rows.join('\n').slice(0, 4_500_000);
  const transcriptFile = new AttachmentBuilder(Buffer.from(transcript || 'Brak danych.', 'utf8'), {
    name: `bulk-delete-${first.channelId}-${Date.now()}.txt`,
  });

  await sendLog(first.guild, 'message', 'Masowe usunięcie wiadomości', [
    ['Kanał', channelMention(first.channelId), true],
    ['Liczba', String(messages.size), true],
    ['Czas', `${stamp(Date.now())}\n${stamp(Date.now(), 'R')}`, true],
    ['Transcript', 'Do logu dołączono plik `.txt` z danymi, które bot miał dostępne w snapshotach.'],
  ], {
    description: 'Discord nie zawsze udostępnia jednoznacznego sprawcę każdej wiadomości usuniętej zbiorczo.',
    files: [transcriptFile],
  });
}

export async function logVoice(oldState, newState) {
  if (newState.guild.id !== config.guildId) return;

  const changes = [];
  let title = 'Zmieniono stan głosowy';

  if (oldState.channelId !== newState.channelId) {
    const before = oldState.channelId ? channelMention(oldState.channelId) : 'Poza kanałem głosowym';
    const after = newState.channelId ? channelMention(newState.channelId) : 'Poza kanałem głosowym';
    changes.push(['Kanał', `${before} → ${after}`]);

    if (!oldState.channelId) title = 'Dołączono do kanału głosowego';
    else if (!newState.channelId) title = 'Opuszczono kanał głosowy';
    else title = 'Zmieniono kanał głosowy';
  }

  if (oldState.serverMute !== newState.serverMute) {
    changes.push(['Server mute', newState.serverMute ? 'Włączono' : 'Wyłączono', true]);
  }
  if (oldState.serverDeaf !== newState.serverDeaf) {
    changes.push(['Server deaf', newState.serverDeaf ? 'Włączono' : 'Wyłączono', true]);
  }
  if (oldState.selfMute !== newState.selfMute) {
    changes.push(['Mikrofon', newState.selfMute ? 'Wyciszony' : 'Włączony', true]);
  }
  if (oldState.selfDeaf !== newState.selfDeaf) {
    changes.push(['Dźwięk', newState.selfDeaf ? 'Wyciszony' : 'Włączony', true]);
  }
  if (oldState.streaming !== newState.streaming) {
    changes.push(['Stream', newState.streaming ? 'Rozpoczęto' : 'Zakończono', true]);
  }
  if (oldState.selfVideo !== newState.selfVideo) {
    changes.push(['Kamera', newState.selfVideo ? 'Włączono' : 'Wyłączono', true]);
  }

  if (!changes.length) return;

  await sendLog(newState.guild, 'voice', title, [
    ['Użytkownik', `${who(newState.id)} • \`${newState.id}\``],
    ...changes,
    ['Czas', `${stamp(Date.now())} • ${stamp(Date.now(), 'R')}`],
  ], {
    thumbnail: newState.member?.displayAvatarURL?.({ extension: 'png', size: 128 }) || null,
  });
}

export async function logJoin(member) {
  if (member.guild.id !== config.guildId) return;

  const ageDays = Math.max(
    0,
    Math.floor((Date.now() - member.user.createdTimestamp) / 86_400_000),
  );
  const image = await welcomeCard(userForCard(member), member.guild.memberCount).catch(() => null);
  const accountNotice = ageDays < 7
    ? '⚠️ Konto ma mniej niż 7 dni.'
    : ageDays < 30
      ? 'ℹ️ Konto ma mniej niż 30 dni.'
      : 'Konto bez flagi wieku.';

  await sendLog(member.guild, 'account', 'Nowy użytkownik na serwerze', [
    ['Użytkownik', `${who(member.id)} • **${clip(member.user.username, 120)}**`, true],
    ['ID', `\`${member.id}\``, true],
    ['Członkowie', String(member.guild.memberCount), true],
    ['Utworzono konto', `${stamp(member.user.createdTimestamp)} • ${stamp(member.user.createdTimestamp, 'R')}`],
    ['Wiek konta', `${ageDays} dni • ${accountNotice}`],
    ['Dołączenie', `${stamp(member.joinedTimestamp || Date.now())} • ${stamp(member.joinedTimestamp || Date.now(), 'R')}`],
  ], {
    image,
    imageName: 'welcome.png',
    thumbnail: image ? null : member.displayAvatarURL({ extension: 'png', size: 256 }),
  });
}

export async function logLeave(member) {
  if (member.guild.id !== config.guildId) return;

  const ageDays = Math.max(
    0,
    Math.floor((Date.now() - member.user.createdTimestamp) / 86_400_000),
  );
  const roles = member.roles.cache
    .filter(role => role.id !== member.guild.id)
    .sort((a, b) => b.position - a.position)
    .map(role => roleMention(role.id));

  await sendLog(member.guild, 'account', 'Użytkownik opuścił serwer', [
    ['Użytkownik', `${who(member.id)} • **${clip(member.user.username, 120)}**`, true],
    ['ID', `\`${member.id}\``, true],
    ['Członkowie', String(member.guild.memberCount), true],
    ['Wiek konta', `${ageDays} dni`],
    ...(roles.length ? [['Role przy wyjściu', listWithOverflow(roles, 15)]] : []),
    ['Czas', `${stamp(Date.now())} • ${stamp(Date.now(), 'R')}`],
  ], {
    description: 'Jeżeli użytkownik został wyrzucony lub zbanowany, odpowiedni wpis pojawi się również w logu zmian z Audit Logu.',
    thumbnail: member.displayAvatarURL?.({ extension: 'png', size: 256 }) || null,
  });
}

const memberAuditKeys = entry => new Set((entry.changes || []).map(change => change.key));

export async function logMemberUpdate(oldMember, newMember) {
  if (newMember.guild.id !== config.guildId) return;

  const fields = [];
  const roleFields = [];
  const memberFields = [];

  if (oldMember.nickname !== newMember.nickname) {
    memberFields.push([
      'Nick serwerowy',
      `${clip(oldMember.nickname || '(brak)', 180)} → ${clip(newMember.nickname || '(brak)', 180)}`,
    ]);
  }

  if (
    oldMember.communicationDisabledUntilTimestamp
    !== newMember.communicationDisabledUntilTimestamp
  ) {
    const until = newMember.communicationDisabledUntilTimestamp;
    memberFields.push([
      'Timeout',
      until
        ? `Aktywny do ${stamp(until)} • ${stamp(until, 'R')}`
        : 'Timeout zakończony / usunięty',
    ]);
  }

  const addedRoles = newMember.roles.cache
    .filter(role => !oldMember.roles.cache.has(role.id) && role.id !== newMember.guild.id)
    .map(role => roleMention(role.id));
  const removedRoles = oldMember.roles.cache
    .filter(role => !newMember.roles.cache.has(role.id) && role.id !== newMember.guild.id)
    .map(role => roleMention(role.id));

  if (addedRoles.length) roleFields.push(['Nadano role', listWithOverflow(addedRoles, 15)]);
  if (removedRoles.length) roleFields.push(['Usunięto role', listWithOverflow(removedRoles, 15)]);

  let memberActor = null;
  let roleActor = null;

  if ((memberFields.length || roleFields.length) && canReadAudit(newMember.guild)) {
    await sleep(700);

    if (memberFields.length) {
      const entry = await recentAuditEntry(
        newMember.guild,
        AuditLogEvent.MemberUpdate,
        newMember.id,
        auditEntry => {
          const keys = memberAuditKeys(auditEntry);
          return keys.has('nick') || keys.has('communication_disabled_until');
        },
      );
      memberActor = entry?.executorId || null;
    }

    if (roleFields.length) {
      const entry = await recentAuditEntry(
        newMember.guild,
        AuditLogEvent.MemberRoleUpdate,
        newMember.id,
      );
      roleActor = entry?.executorId || null;
    }
  }

  if (memberFields.length) {
    fields.push(...memberFields);
    fields.push([
      'Wykonał zmianę danych',
      memberActor ? `${who(memberActor)} • \`${memberActor}\`` : 'Nieustalone / zmiana własna',
    ]);
  }

  if (roleFields.length) {
    fields.push(...roleFields);
    fields.push([
      'Wykonał zmianę ról',
      roleActor ? `${who(roleActor)} • \`${roleActor}\`` : 'Nieustalone',
    ]);
  }

  if (fields.length) {
    await sendLog(newMember.guild, 'change', 'Zmieniono użytkownika', [
      ['Użytkownik', `${who(newMember.id)} • \`${newMember.id}\``],
      ...fields,
      ['Czas', `${stamp(Date.now())} • ${stamp(Date.now(), 'R')}`],
    ], {
      thumbnail: newMember.displayAvatarURL?.({ extension: 'png', size: 256 }) || null,
    });
  }

  if (oldMember.avatar !== newMember.avatar) {
    await sendLog(newMember.guild, 'account', 'Zmieniono awatar serwerowy', [
      ['Użytkownik', `${who(newMember.id)} • \`${newMember.id}\``],
      ['Czas', `${stamp(Date.now())} • ${stamp(Date.now(), 'R')}`],
    ], {
      thumbnail: newMember.displayAvatarURL?.({ extension: 'png', size: 256 }) || null,
    });
  }
}

export async function logUserUpdate(oldUser, newUser, client) {
  const usernameChanged = oldUser.username !== newUser.username;
  const globalNameChanged = oldUser.globalName !== newUser.globalName;
  const avatarChanged = oldUser.avatar !== newUser.avatar;

  if (!usernameChanged && !globalNameChanged && !avatarChanged) return;

  const guild = client.guilds.cache.get(config.guildId)
    ?? await client.guilds.fetch(config.guildId).catch(() => null);
  if (!guild) return;

  const member = guild.members.cache.get(newUser.id)
    ?? await guild.members.fetch(newUser.id).catch(() => null);
  if (!member) return;

  const fields = [
    ['Użytkownik', `${who(newUser.id)} • \`${newUser.id}\``],
  ];

  if (usernameChanged) {
    fields.push(['Nazwa użytkownika', `${clip(oldUser.username, 180)} → ${clip(newUser.username, 180)}`]);
  }
  if (globalNameChanged) {
    fields.push([
      'Nazwa wyświetlana',
      `${clip(oldUser.globalName || '(brak)', 180)} → ${clip(newUser.globalName || '(brak)', 180)}`,
    ]);
  }
  if (avatarChanged) {
    fields.push(['Awatar', 'Zmieniono globalne zdjęcie profilowe']);
  }

  fields.push(['Czas', `${stamp(Date.now())} • ${stamp(Date.now(), 'R')}`]);

  await sendLog(guild, 'account', 'Zmieniono profil Discord', fields, {
    thumbnail: newUser.displayAvatarURL({ extension: 'png', size: 256 }),
  });
}

const AUDIT_NAMES = new Map([
  [AuditLogEvent.GuildUpdate, 'Zmieniono ustawienia serwera'],

  [AuditLogEvent.ChannelCreate, 'Utworzono kanał'],
  [AuditLogEvent.ChannelUpdate, 'Zmieniono kanał'],
  [AuditLogEvent.ChannelDelete, 'Usunięto kanał'],
  [AuditLogEvent.ChannelOverwriteCreate, 'Dodano nadpisanie uprawnień'],
  [AuditLogEvent.ChannelOverwriteUpdate, 'Zmieniono nadpisanie uprawnień'],
  [AuditLogEvent.ChannelOverwriteDelete, 'Usunięto nadpisanie uprawnień'],

  [AuditLogEvent.MemberKick, 'Wyrzucono użytkownika'],
  [AuditLogEvent.MemberBanAdd, 'Zbanowano użytkownika'],
  [AuditLogEvent.MemberBanRemove, 'Usunięto bana'],
  [AuditLogEvent.MemberMove, 'Przeniesiono użytkownika na VC'],
  [AuditLogEvent.MemberDisconnect, 'Odłączono użytkownika z VC'],
  [AuditLogEvent.BotAdd, 'Dodano bota'],

  // MemberUpdate i MemberRoleUpdate są obsługiwane wyżej, aby uniknąć podwójnych logów.

  [AuditLogEvent.RoleCreate, 'Utworzono rolę'],
  [AuditLogEvent.RoleUpdate, 'Zmieniono rolę'],
  [AuditLogEvent.RoleDelete, 'Usunięto rolę'],

  [AuditLogEvent.InviteCreate, 'Utworzono zaproszenie'],
  [AuditLogEvent.InviteUpdate, 'Zmieniono zaproszenie'],
  [AuditLogEvent.InviteDelete, 'Usunięto zaproszenie'],

  [AuditLogEvent.WebhookCreate, 'Utworzono webhook'],
  [AuditLogEvent.WebhookUpdate, 'Zmieniono webhook'],
  [AuditLogEvent.WebhookDelete, 'Usunięto webhook'],

  [AuditLogEvent.EmojiCreate, 'Dodano emoji'],
  [AuditLogEvent.EmojiUpdate, 'Zmieniono emoji'],
  [AuditLogEvent.EmojiDelete, 'Usunięto emoji'],

  [AuditLogEvent.StickerCreate, 'Dodano naklejkę'],
  [AuditLogEvent.StickerUpdate, 'Zmieniono naklejkę'],
  [AuditLogEvent.StickerDelete, 'Usunięto naklejkę'],

  [AuditLogEvent.ThreadCreate, 'Utworzono wątek'],
  [AuditLogEvent.ThreadUpdate, 'Zmieniono wątek'],
  [AuditLogEvent.ThreadDelete, 'Usunięto wątek'],
]);

const MEMBER_AUDIT_ACTIONS = new Set([
  AuditLogEvent.MemberKick,
  AuditLogEvent.MemberBanAdd,
  AuditLogEvent.MemberBanRemove,
  AuditLogEvent.MemberMove,
  AuditLogEvent.MemberDisconnect,
  AuditLogEvent.BotAdd,
]);

const ROLE_AUDIT_ACTIONS = new Set([
  AuditLogEvent.RoleCreate,
  AuditLogEvent.RoleUpdate,
  AuditLogEvent.RoleDelete,
]);

const CHANNEL_AUDIT_ACTIONS = new Set([
  AuditLogEvent.ChannelCreate,
  AuditLogEvent.ChannelUpdate,
  AuditLogEvent.ChannelDelete,
  AuditLogEvent.ChannelOverwriteCreate,
  AuditLogEvent.ChannelOverwriteUpdate,
  AuditLogEvent.ChannelOverwriteDelete,
  AuditLogEvent.ThreadCreate,
  AuditLogEvent.ThreadUpdate,
  AuditLogEvent.ThreadDelete,
]);

const CHANGE_LABELS = {
  name: 'Nazwa',
  nick: 'Nick',
  topic: 'Temat',
  nsfw: 'NSFW',
  bitrate: 'Bitrate',
  user_limit: 'Limit użytkowników',
  rate_limit_per_user: 'Slowmode',
  color: 'Kolor',
  hoist: 'Wyświetlaj osobno',
  mentionable: 'Można oznaczać',
  permissions: 'Uprawnienia',
  communication_disabled_until: 'Timeout do',
  deaf: 'Deaf',
  mute: 'Mute',
};

function auditTarget(entry) {
  if (!entry.targetId) return 'Serwer / brak ID celu';
  if (MEMBER_AUDIT_ACTIONS.has(entry.action)) return `${who(entry.targetId)} • \`${entry.targetId}\``;
  if (ROLE_AUDIT_ACTIONS.has(entry.action)) return `${roleMention(entry.targetId)} • \`${entry.targetId}\``;
  if (CHANNEL_AUDIT_ACTIONS.has(entry.action)) return `${channelMention(entry.targetId)} • \`${entry.targetId}\``;
  return `\`${entry.targetId}\``;
}

function formatAuditValue(key, value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Tak' : 'Nie';

  if (key === 'color' && Number.isInteger(value)) {
    return `#${value.toString(16).padStart(6, '0').toUpperCase()}`;
  }

  if (Array.isArray(value)) {
    const roles = value
      .filter(item => item && typeof item === 'object' && item.id)
      .map(item => roleMention(item.id));
    if (roles.length === value.length) return listWithOverflow(roles, 12);
  }

  if (typeof value === 'object') {
    try {
      return clip(JSON.stringify(value, (_, nested) => (
        typeof nested === 'bigint' ? String(nested) : nested
      )), 260);
    } catch {
      return '[obiekt]';
    }
  }

  return clip(value, 260);
}

function formatAuditChanges(changes = []) {
  return changes.slice(0, 8).map(change => {
    if (change.key === '$add' || change.key === '$remove') {
      const roles = (change.new || []).map(role => roleMention(role.id));
      return `${change.key === '$add' ? 'Nadano role' : 'Usunięto role'}: ${roles.join(', ') || '—'}`;
    }

    const label = CHANGE_LABELS[change.key] || change.key;
    return `**${clip(label, 80)}:** ${formatAuditValue(change.key, change.old)} → ${formatAuditValue(change.key, change.new)}`;
  }).join('\n');
}

export async function logAudit(entry, guild) {
  if (guild.id !== config.guildId) return;

  const title = AUDIT_NAMES.get(entry.action);
  if (!title) return;

  const details = formatAuditChanges(entry.changes || []);

  await sendLog(guild, 'change', title, [
    ['Wykonał', entry.executorId ? `${who(entry.executorId)} • \`${entry.executorId}\`` : 'Nieznany', true],
    ['Cel', auditTarget(entry), true],
    ['Audit ID', `\`${entry.id}\``, true],
    ...(entry.reason ? [['Powód', entry.reason]] : []),
    ...(details ? [['Szczegóły', details]] : []),
    ['Czas', `${stamp(entry.createdTimestamp)} • ${stamp(entry.createdTimestamp, 'R')}`],
  ]);
}

export async function logStaffAction(guild, action, actorId, targetId, details) {
  if (guild.id !== config.guildId) return;

  await sendLog(guild, 'change', action, [
    ['Moderator', actorId ? `${who(actorId)} • \`${actorId}\`` : 'Nieznany', true],
    ['Użytkownik', targetId ? `${who(targetId)} • \`${targetId}\`` : 'Brak', true],
    ['Czas', `${stamp(Date.now())} • ${stamp(Date.now(), 'R')}`, true],
    ['Szczegóły', details || 'Brak dodatkowych informacji'],
  ]);
}
