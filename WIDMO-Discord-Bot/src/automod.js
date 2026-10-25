import { config } from './config.js';
import { getStats } from './levels.js';
import { logEvent } from './logging.js';
import { embed, safeText, isBotOwner } from './shared.js';
import { accessLevel } from './level-helpers.js';
import { assessMessage } from './automod-helpers.js';

const handled = new Map();
const notices = new Map();

export function checkMessage(message) {
  if (!message.guild || message.guild.id !== config.guildId || message.author?.bot) return { allowed: true };
  const roleIds = new Set(message.member?.roles?.cache?.keys() || []);
  const stats = getStats(message.guild.id, message.author.id);
  return assessMessage({
    content: message.content,
    linkTexts: (message.embeds || []).flatMap((item) => item.url ? [item.url] : []),
    hasAttachments: Boolean(message.attachments?.size),
    hasStickers: Boolean(message.stickers?.size),
    veteran: roleIds.has(config.roles.veteran) || isBotOwner(message.author),
    level: accessLevel(stats.level, roleIds, config.roles.levels),
  }, config.automod);
}

export async function enforceMessage(message) {
  if (!message.guild || message.guild.id !== config.guildId || message.author?.bot) return true;
  if (!message.member) {
    try { await message.guild.members.fetch(message.author.id); }
    catch (error) { console.error('[automod] Nie udało się sprawdzić ról autora:', error); return false; }
  }
  const decision = checkMessage(message);
  if (decision.allowed) return true;
  const now = Date.now();
  for (const [id, expires] of handled) if (expires < now) handled.delete(id);
  for (const [id, expires] of notices) if (expires < now) notices.delete(id);
  if (handled.has(message.id)) return false;
  handled.set(message.id, now + 60_000);
  let removed = false;
  let errorText = '';
  try { await message.delete(); removed = true; }
  catch (error) {
    // A moderator or another concurrent event may already have deleted the message.
    if (error.code === 10008) return false;
    errorText = `Nie udało się usunąć wiadomości: ${error.message}`;
    handled.delete(message.id); // Allow a subsequent edit/event to retry.
    console.error('[automod]', error);
  }
  try {
    await logEvent(message.client, config.channels.messages, {
      title: removed ? '🛡️ Automod — usunięto wiadomość' : '⚠️ Automod — brak możliwości usunięcia',
      description: decision.reason,
      fields: [
        { name: 'Autor', value: `${safeText(message.author.tag || message.author.username, 100)}\nID: ${message.author.id}`, inline: true },
        { name: 'Kanał / wiadomość', value: `<#${message.channelId}>\n${message.id}`, inline: true },
        { name: 'Treść', value: safeText(message.content || '[Załącznik / naklejka]', 1000) },
        ...(errorText ? [{ name: 'Błąd', value: safeText(errorText, 1000) }] : []),
      ],
    });
  } catch (error) { console.error('[automod] Błąd logowania:', error); }
  const key = `${message.channelId}:${message.author.id}`;
  if (removed && !notices.has(key)) {
    notices.set(key, now + 10_000);
    try {
      const notice = await message.channel.send({
        embeds: [embed('🛡️ Zasady publikowania', `${safeText(message.author.username, 100)}: ${decision.reason}`)],
        allowedMentions: { parse: [] },
      });
      const timeout = setTimeout(() => notice.delete().catch(() => {}), config.automod.noticeSeconds * 1000);
      timeout.unref?.();
    } catch (error) { console.error('[automod] Błąd wysyłania informacji:', error); }
  }
  return false;
}
