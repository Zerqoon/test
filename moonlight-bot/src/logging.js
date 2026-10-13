import { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, AuditLogEvent } from 'discord.js';
import { db } from './db.js';
import { config } from './config.js';
import { embed, safeText } from './shared.js';

db.exec(`CREATE TABLE IF NOT EXISTS message_snapshots (
  id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL,
  author_id TEXT, data TEXT NOT NULL, updated_at INTEGER NOT NULL
); CREATE INDEX IF NOT EXISTS snapshot_age ON message_snapshots(updated_at);`);
const ignoredChannels = new Set([config.channels.messages, config.channels.members, config.channels.moderation]);
const getSnapshot = id => {
  const row = db.prepare('SELECT data FROM message_snapshots WHERE id=?').get(id);
  return row ? JSON.parse(row.data) : null;
};
function snapshot(m) {
  return {
    id: m.id, guildId: m.guildId, channelId: m.channelId,
    authorId: m.author?.id ?? null, author: m.author?.tag ?? 'Nieznany autor',
    content: m.content ?? '',
    attachments: [...(m.attachments?.values() ?? [])].map(a => ({ name: a.name, url: a.url, type: a.contentType })),
    embeds: (m.embeds ?? []).map(e => ({ url: e.url, title: e.title, description: e.description, image: e.image?.url, video: e.video?.url })),
    stickers: [...(m.stickers?.values() ?? [])].map(s => ({ name: s.name, url: s.url })),
  };
}
function save(s) {
  db.prepare(`INSERT INTO message_snapshots VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at,author_id=excluded.author_id`)
    .run(s.id, s.guildId, s.channelId, s.authorId, JSON.stringify(s), Date.now());
}
function eligible(m) { return m.guildId === config.guildId && !m.author?.bot && !ignoredChannels.has(m.channelId); }
function links(s) {
  return [...(s.attachments ?? []).map(a => `${a.name}: ${a.url}`), ...(s.embeds ?? []).flatMap(e => [e.url,e.image,e.video]).filter(Boolean), ...(s.stickers ?? []).map(a => `${a.name}: ${a.url}`)].join('\n');
}
function fullText(s) { return `Autor: ${s.author} (${s.authorId ?? 'nieznany'})\nKanał: ${s.channelId}\nWiadomość: ${s.id}\n\n${s.content}\n\nMedia:\n${links(s) || 'Brak'}`; }
function jump(guildId, channelId, id) {
  return new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(id ? 'Przejdź do wiadomości' : 'Otwórz kanał').setURL(`https://discord.com/channels/${guildId}/${channelId}${id ? `/${id}` : ''}`));
}
function identity(s) { return [{ name: 'Autor · ID', value: safeText(`${s.author} · ${s.authorId ?? 'brak w cache'}`) }, { name: 'Kanał · wiadomość', value: `<#${s.channelId}>\n\`${s.id}\`` }]; }

export async function logEvent(client, channelId, { title, description, fields = [], color, components = [], files = [] }) {
  const ch = await client.channels.fetch(channelId);
  if (!ch?.isTextBased() || !ch.send || ch.guildId !== config.guildId) throw new Error(`Kanał logów ${channelId} nie istnieje, nie jest tekstowy lub należy do innego serwera.`);
  const e = embed(title, description, color);
  let budget = 5600 - e.data.title.length - (e.data.description?.length ?? 0);
  for (const field of fields.slice(0, 25)) {
    const name = safeText(field.name, 256);
    if (budget < name.length + 2) break;
    const value = safeText(field.value, Math.min(1024, budget - name.length));
    e.addFields({ name, value, inline: Boolean(field.inline) }); budget -= name.length + value.length;
  }
  return ch.send({ embeds: [e], components, files, allowedMentions: { parse: [] } });
}

export function installLogging(client) {
  const pending = new Map();
  const listeners = [];
  const register = (event, fn) => {
    const wrapped = (...args) => { Promise.resolve().then(() => fn(...args)).catch(e => console.error(`[log:${event}]`, e)); };
    client.on(event, wrapped); listeners.push([event, wrapped]);
  };
  const queue = (id, task) => {
    const prior = pending.get(id) ?? Promise.resolve();
    const next = prior.catch(() => {}).then(task);
    pending.set(id, next);
    next.finally(() => { if (pending.get(id) === next) pending.delete(id); }).catch(() => {});
    return next;
  };
  register(Events.MessageCreate, m => {
    if (!eligible(m)) return;
    // The snapshot is captured before the moderation handler can delete the message.
    const s = snapshot(m); save(s);
    const mediaText = `${s.content}\n${links(s)}`;
    if (/\.gif(?:[?\s]|$)|(?:tenor\.com|giphy\.com|gph\.is)\//i.test(mediaText)) {
      return logEvent(client, config.channels.messages, {
        title: '🎞️ Wysłano GIF', description: safeText(mediaText, 1800), fields: identity(s),
        components: [jump(s.guildId, s.channelId, s.id)],
      });
    }
  });
  register(Events.MessageUpdate, (oldMessage, message) => {
    if (!eligible(message)) return;
    return queue(message.id, async () => {
      const before = getSnapshot(message.id) ?? (!oldMessage.partial ? snapshot(oldMessage) : null);
      let m = message;
      if (m.partial) { try { m = await m.fetch(); } catch { return; } }
      if (!eligible(m)) return;
      const after = snapshot(m); save(after);
      // Ignore embed-preview hydration; content, attachment and sticker changes still log.
      if (before && before.content === after.content && JSON.stringify(before.attachments) === JSON.stringify(after.attachments) && JSON.stringify(before.stickers) === JSON.stringify(after.stickers)) return;
      await logEvent(client, config.channels.messages, {
        title: '✏️ Edytowana wiadomość', fields: [...identity(after),
          { name: 'Przed', value: safeText(before?.content || (before ? '(brak tekstu)' : 'Treść sprzed edycji niedostępna — bot jej nie zapisał.')) },
          { name: 'Po', value: safeText(after.content || '(brak tekstu)') },
          { name: 'Media po edycji', value: safeText(links(after) || 'Brak') }],
        components: [jump(after.guildId, after.channelId, after.id)],
        files: [new AttachmentBuilder(Buffer.from(`PRZED\n${before ? fullText(before) : 'Niedostępne'}\n\nPO\n${fullText(after)}`, 'utf8'), { name: `edycja-${after.id}.txt` })],
      });
    });
  });
  register(Events.MessageDelete, m => {
    if (!eligible(m)) return;
    return queue(m.id, async () => {
      const s = getSnapshot(m.id) ?? snapshot(m);
      db.prepare('DELETE FROM message_snapshots WHERE id=?').run(m.id);
      await logEvent(client, config.channels.messages, {
        title: '🗑️ Usunięta wiadomość', description: 'Usuniętej wiadomości nie da się otworzyć. Przycisk prowadzi do kanału.',
        fields: [...identity(s), { name: 'Treść', value: safeText(s.content || '(treść niedostępna lub wiadomość bez tekstu)') }, { name: 'Media / GIF', value: safeText(links(s) || 'Brak zapisanych mediów') }],
        components: [jump(s.guildId, s.channelId)],
        files: [new AttachmentBuilder(Buffer.from(fullText(s), 'utf8'), { name: `usunieta-${s.id}.txt` })], color: '#E277A8',
      });
    });
  });
  register(Events.MessageBulkDelete, async messages => {
    const entries = [...messages.values()].filter(eligible).map(m => getSnapshot(m.id) ?? snapshot(m));
    if (!entries.length) return;
    for (const s of entries) db.prepare('DELETE FROM message_snapshots WHERE id=?').run(s.id);
    await logEvent(client, config.channels.messages, { title: '🧹 Zbiorcze usunięcie wiadomości', description: `Usunięto **${entries.length}** wiadomości w <#${entries[0].channelId}>. Pełna dostępna treść, ID autorów i media w załączniku.`, components: [jump(entries[0].guildId, entries[0].channelId)], files: [new AttachmentBuilder(Buffer.from(entries.map(fullText).join('\n\n────────────────\n\n')), { name: `usuniete-${Date.now()}.txt` })] });
  });
  register(Events.GuildMemberAdd, m => {
    if (m.guild.id !== config.guildId) return;
    return logEvent(client, config.channels.members, { title: '🌙 Nowa osoba na serwerze', description: `<@${m.id}> • **${safeText(m.user.tag, 100)}**`, fields: [{ name: 'ID użytkownika', value: m.id }, { name: 'Konto utworzone', value: `<t:${Math.floor(m.user.createdTimestamp / 1000)}:F>` }, { name: 'Liczba osób', value: String(m.guild.memberCount) }] });
  });
  register(Events.GuildMemberRemove, m => {
    if (m.guild.id !== config.guildId) return;
    return logEvent(client, config.channels.members, { title: '🚪 Opuszczenie serwera', description: `${safeText(m.user.tag, 100)} • ID: \`${m.id}\``, fields: [{ name: 'Ostatnie zapisane role', value: safeText([...m.roles.cache.values()].filter(r => r.id !== m.guild.id).map(r => `${r.name} (${r.id})`).join('\n') || 'Brak danych') }] });
  });
  register(Events.GuildMemberUpdate, (a, b) => {
    if (b.guild.id !== config.guildId) return;
    const added = b.roles.cache.filter(r => !a.roles.cache.has(r.id));
    const removed = a.roles.cache.filter(r => !b.roles.cache.has(r.id));
    const fields = [{ name: 'Użytkownik · ID', value: `${b.user.tag} · ${b.id}` }];
    if (added.size) fields.push({ name: 'Nadane role', value: safeText(added.map(r => `${r.name} (${r.id})`).join('\n')) });
    if (removed.size) fields.push({ name: 'Odebrane role', value: safeText(removed.map(r => `${r.name} (${r.id})`).join('\n')) });
    if (a.nickname !== b.nickname) fields.push({ name: 'Pseudonim', value: safeText(`${a.nickname ?? '(brak)'} → ${b.nickname ?? '(brak)'}`) });
    if (a.communicationDisabledUntilTimestamp !== b.communicationDisabledUntilTimestamp) fields.push({ name: 'Timeout', value: b.communicationDisabledUntilTimestamp ? `<t:${Math.floor(b.communicationDisabledUntilTimestamp / 1000)}:F>` : 'Usunięty / wygasł' });
    if (a.premiumSinceTimestamp !== b.premiumSinceTimestamp) fields.push({ name: 'Boost serwera', value: b.premiumSinceTimestamp ? 'Rozpoczęty 💜' : 'Zakończony' });
    if (fields.length === 1) return;
    return logEvent(client, config.channels.moderation, { title: '🔄 Zmiana konta / ról', fields });
  });
  register(Events.GuildAuditLogEntryCreate, (entry, guild) => {
    if (guild.id !== config.guildId) return;
    return logEvent(client, config.channels.moderation, {
      title: `🛡️ Audyt · ${AuditLogEvent[entry.action] ?? entry.action}`,
      fields: [{ name: 'Wykonawca · ID', value: entry.executorId ? `${entry.executor?.tag ?? 'Użytkownik'} · ${entry.executorId}` : 'Discord nie podał wykonawcy' },
        { name: 'Obiekt / użytkownik · ID', value: safeText(entry.targetId ?? 'Brak') },
        { name: 'Powód', value: safeText(entry.reason || 'Nie podano') },
        { name: 'Zmiany', value: safeText(JSON.stringify(entry.changes ?? []), 1000) },
        { name: 'ID audytu', value: entry.id }],
    });
  });
  const prune = () => {
    db.prepare('DELETE FROM message_snapshots WHERE updated_at < ?').run(Date.now() - config.logging.retentionDays * 86400000);
    db.prepare('DELETE FROM message_snapshots WHERE id IN (SELECT id FROM message_snapshots ORDER BY updated_at DESC LIMIT -1 OFFSET ?)').run(config.logging.maxSnapshots);
  };
  prune(); const timer = setInterval(prune, 3600000); timer.unref();
  return { stop() { clearInterval(timer); for (const [event, fn] of listeners) client.off(event, fn); } };
}
