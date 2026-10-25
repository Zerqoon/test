import { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, escapeMarkdown } from 'discord.js';
import { db } from './db.js';
import { config } from './config.js';
import { embed } from './shared.js';
import { auditTitle, auditFields } from './audit-format.js';

// Discord counts UTF-16 units; never leave half an emoji at a truncation boundary.
function clip(value, max) {
  const text = String(value ?? '') || 'Brak danych';
  if (text.length <= max) return text;
  let end = max - 1;
  if (/[\uD800-\uDBFF]/.test(text[end - 1])) end--;
  return `${text.slice(0, end)}…`;
}
const displayName = user => escapeMarkdown(user?.tag ?? user?.username ?? 'Nieznany użytkownik');

db.exec(`CREATE TABLE IF NOT EXISTS message_snapshots (
  id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL,
  author_id TEXT, data TEXT NOT NULL, updated_at INTEGER NOT NULL
); CREATE INDEX IF NOT EXISTS snapshot_age ON message_snapshots(updated_at);`);
const ignoredChannels = () => new Set([config.channels.messages, config.channels.members, config.channels.moderation, config.channels.actions].filter(Boolean));
const getSnapshot = id => {
  const row = db.prepare('SELECT data FROM message_snapshots WHERE id=?').get(id);
  return row ? JSON.parse(row.data) : null;
};
function snapshot(m) {
  return {
    id: m.id, guildId: m.guildId, channelId: m.channelId,
    authorId: m.author?.id ?? null, author: m.author?.tag ?? m.author?.username ?? 'Nieznany autor',
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
function eligible(m) { return m.guildId === config.guildId && !m.author?.bot && !ignoredChannels().has(m.channelId); }
function links(s) {
  return [...new Set([...(s.attachments ?? []).filter(a => a.url).map(a => `${a.name || 'Załącznik'}: ${a.url}`), ...(s.embeds ?? []).flatMap(e => [e.url,e.image,e.video]).filter(Boolean), ...(s.stickers ?? []).filter(a => a.url).map(a => `${a.name || 'Naklejka'}: ${a.url}`)])].join('\n');
}
function fullText(s) { return `Autor: ${s.author} (${s.authorId ?? 'nieznany'})\nKanał: ${s.channelId}\nWiadomość: ${s.id}\n\n${s.content}\n\nMedia:\n${links(s) || 'Brak'}`; }
function jump(guildId, channelId, id) {
  return new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(id ? 'Przejdź do wiadomości' : 'Otwórz kanał').setURL(`https://discord.com/channels/${guildId}/${channelId}${id ? `/${id}` : ''}`));
}
function identity(s) { return [{ name: 'Autor', value: `${escapeMarkdown(s.author)}\nID: ${s.authorId ?? 'Nie zapisano'}` }, { name: 'Kanał', value: `<#${s.channelId}>`, inline: true }, { name: 'ID wiadomości', value: s.id, inline: true }]; }

export async function logEvent(client, channelId, { title, description, fields = [], color, components = [], files = [] }) {
  if (!channelId || !/^\d{17,20}$/.test(String(channelId))) return null;
  const ch = await client.channels.fetch(channelId);
  if (!ch?.isTextBased() || !ch.send || ch.guildId !== config.guildId) throw new Error(`Kanał logów ${channelId} nie istnieje, nie jest tekstowy lub należy do innego serwera.`);
  const heading = String(title ?? 'Zdarzenie na serwerze');
  const summary = String(description ?? '');
  const e = embed(clip(heading, 256), summary ? clip(summary, 4096) : undefined, color);
  let overflow = heading.length > 256 || summary.length > 4096;
  // Reserve space and one field for the full-text attachment notice.
  let budget = 5850 - e.data.title.length - (e.data.description?.length ?? 0) - (e.data.footer?.text?.length ?? 0);
  let added = 0;
  for (const field of fields) {
    const name = clip(field.name, 256);
    if (added === 24 || budget < name.length + 2) { overflow = true; break; }
    const original = String(field.value ?? '') || 'Brak danych';
    const value = clip(original, Math.min(1024, budget - name.length));
    if (value !== original || String(field.name ?? '').length > 256) overflow = true;
    e.addFields({ name, value, inline: Boolean(field.inline) }); budget -= name.length + value.length;
    added++;
  }
  const attachments = [...files];
  if (overflow) {
    e.addFields({ name: 'Pełny zapis', value: 'Dłuższe szczegóły znajdziesz w załączniku szczegoly-logu.txt.' });
    const text = [heading, summary, ...fields.map(field => `${field.name}\n${field.value ?? 'Brak danych'}`)].filter(Boolean).join('\n\n');
    attachments.push(new AttachmentBuilder(Buffer.from(text, 'utf8'), { name: 'szczegoly-logu.txt' }));
  }
  return ch.send({ embeds: [e], components, files: attachments, allowedMentions: { parse: [], repliedUser: false } });
}

export function installLogging(client) {
  const pending = new Map();
  const listeners = [];
  const register = (event, fn) => {
    const failed = e => console.error(`[logi:${event}] ${e?.message ?? 'Nieznany błąd'}${e?.code ? ` (kod ${e.code})` : ''}`);
    const wrapped = (...args) => {
      try { Promise.resolve(fn(...args)).catch(failed); } catch (e) { failed(e); }
    };
    client.on(event, wrapped); listeners.push([event, wrapped]);
  };
  const queueMany = (ids, task) => {
    const prior = ids.map(id => pending.get(id) ?? Promise.resolve());
    const next = Promise.all(prior.map(p => p.catch(() => {}))).then(task);
    for (const id of ids) pending.set(id, next);
    next.finally(() => { for (const id of ids) if (pending.get(id) === next) pending.delete(id); }).catch(() => {});
    return next;
  };
  const queue = (id, task) => queueMany([id], task);
  register(Events.MessageCreate, m => {
    if (!eligible(m)) return;
    // The snapshot is captured before the moderation handler can delete the message.
    const s = snapshot(m); save(s);
    const mediaText = `${s.content}\n${links(s)}`;
    if (/\.gif(?:[?\s]|$)|(?:tenor\.com|giphy\.com|gph\.is)\//i.test(mediaText)) {
      return logEvent(client, config.channels.messages, {
        title: '🎞️ Wysłano GIF', description: mediaText, fields: identity(s),
        components: [jump(s.guildId, s.channelId, s.id)],
      });
    }
  });
  register(Events.MessageUpdate, (oldMessage, message) => {
    if (!eligible(message)) return;
    // discord.js mutates cached Message instances on the next edit. Capture the
    // event now, before a previous log's REST request can delay this queue item.
    const captured = !message.partial ? snapshot(message) : null;
    const fallback = !oldMessage.partial ? snapshot(oldMessage) : null;
    return queue(message.id, async () => {
      const before = getSnapshot(message.id) ?? fallback;
      let m = message;
      if (m.partial) { try { m = await m.fetch(); } catch { return; } }
      if (!eligible(m)) return;
      const after = captured ?? snapshot(m); save(after);
      // Ignore embed-preview hydration; content, attachment and sticker changes still log.
      if (before && before.content === after.content && JSON.stringify(before.attachments) === JSON.stringify(after.attachments) && JSON.stringify(before.stickers) === JSON.stringify(after.stickers)) return;
      await logEvent(client, config.channels.messages, {
        title: '✏️ Edytowana wiadomość', fields: [...identity(after),
          { name: 'Przed', value: before?.content || (before ? 'Wiadomość bez tekstu' : 'Treść sprzed edycji niedostępna — bot jej nie zapisał.') },
          { name: 'Po', value: after.content || 'Wiadomość bez tekstu' },
          { name: 'Media przed edycją', value: before ? links(before) || 'Brak' : 'Nie zapisano' },
          { name: 'Media po edycji', value: links(after) || 'Brak' }],
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
        fields: [...identity(s), { name: 'Treść', value: s.content || 'Treść niedostępna lub wiadomość bez tekstu' }, { name: 'Media / GIF', value: links(s) || 'Brak zapisanych mediów' }],
        components: [jump(s.guildId, s.channelId)],
        files: [new AttachmentBuilder(Buffer.from(fullText(s), 'utf8'), { name: `usunieta-${s.id}.txt` })], color: '#E277A8',
      });
    });
  });
  register(Events.MessageBulkDelete, messages => {
    const items = [...messages.values()].filter(eligible);
    if (!items.length) return;
    return queueMany(items.map(m => m.id), async () => {
      const entries = items.map(m => getSnapshot(m.id) ?? snapshot(m));
      for (const s of entries) db.prepare('DELETE FROM message_snapshots WHERE id=?').run(s.id);
      await logEvent(client, config.channels.messages, { title: '🧹 Zbiorcze usunięcie wiadomości', description: `Usunięto **${entries.length}** wiadomości w <#${entries[0].channelId}>. Treść, ID autorów i media znajdziesz w załączniku.`, components: [jump(entries[0].guildId, entries[0].channelId)], files: [new AttachmentBuilder(Buffer.from(entries.map(fullText).join('\n\n────────────────\n\n')), { name: `usuniete-${Date.now()}.txt` })] });
    });
  });
  register(Events.GuildMemberAdd, m => {
    if (m.guild.id !== config.guildId) return;
    return logEvent(client, config.channels.members, { title: '👻 Nowa osoba na serwerze', description: `<@${m.id}> • ${displayName(m.user)}`, fields: [{ name: 'ID użytkownika', value: m.id }, { name: 'Konto utworzone', value: m.user?.createdTimestamp ? `<t:${Math.floor(m.user.createdTimestamp / 1000)}:F>` : 'Brak danych' }, { name: 'Liczba osób', value: String(m.guild.memberCount) }] });
  });
  register(Events.GuildMemberRemove, m => {
    if (m.guild.id !== config.guildId) return;
    return logEvent(client, config.channels.members, { title: '🚪 Opuszczenie serwera', description: `${displayName(m.user)}\nID: ${m.id}`, fields: [{ name: 'Ostatnie zapisane role', value: [...(m.roles?.cache?.values() ?? [])].filter(r => r.id !== m.guild.id).map(r => `${escapeMarkdown(r.name)} · ID: ${r.id}`).join('\n') || 'Brak zapisanych ról' }] });
  });
  register(Events.GuildMemberUpdate, (a, b) => {
    if (b.guild.id !== config.guildId) return;
    const added = b.roles.cache.filter(r => !a.roles.cache.has(r.id));
    const removed = a.roles.cache.filter(r => !b.roles.cache.has(r.id));
    const fields = [{ name: 'Użytkownik', value: `${displayName(b.user)}\nID: ${b.id}` }];
    if (added.size) fields.push({ name: 'Nadane role', value: added.map(r => `${escapeMarkdown(r.name)} · ID: ${r.id}`).join('\n') });
    if (removed.size) fields.push({ name: 'Odebrane role', value: removed.map(r => `${escapeMarkdown(r.name)} · ID: ${r.id}`).join('\n') });
    if (a.nickname !== b.nickname) fields.push({ name: 'Pseudonim', value: `Przed: ${escapeMarkdown(a.nickname ?? 'Brak')}\nPo: ${escapeMarkdown(b.nickname ?? 'Brak')}` });
    if (a.communicationDisabledUntilTimestamp !== b.communicationDisabledUntilTimestamp) fields.push({ name: 'Timeout', value: b.communicationDisabledUntilTimestamp ? `<t:${Math.floor(b.communicationDisabledUntilTimestamp / 1000)}:F>` : 'Usunięty / wygasł' });
    if (a.premiumSinceTimestamp !== b.premiumSinceTimestamp) fields.push({ name: 'Boost serwera', value: b.premiumSinceTimestamp ? 'Rozpoczęty 💜' : 'Zakończony' });
    if (fields.length === 1) return;
    return logEvent(client, config.channels.actions || config.channels.moderation, { title: '🔄 Zmiana konta / ról', fields });
  });
  register(Events.GuildAuditLogEntryCreate, (entry, guild) => {
    if (guild.id !== config.guildId) return;
    return logEvent(client, config.channels.actions || config.channels.moderation, { title: auditTitle(entry), fields: auditFields(entry) });
  });
  const prune = () => {
    db.prepare('DELETE FROM message_snapshots WHERE updated_at < ?').run(Date.now() - config.logging.retentionDays * 86400000);
    db.prepare('DELETE FROM message_snapshots WHERE id IN (SELECT id FROM message_snapshots ORDER BY updated_at DESC LIMIT -1 OFFSET ?)').run(config.logging.maxSnapshots);
  };
  prune(); const timer = setInterval(prune, 3600000); timer.unref();
  return { stop() { clearInterval(timer); for (const [event, fn] of listeners) client.off(event, fn); } };
}
