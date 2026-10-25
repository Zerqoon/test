import { EmbedBuilder, MessageFlags } from 'discord.js';
import { config } from './config.js';

export function embed(title, description, color = config.color) {
  const e = new EmbedBuilder().setColor(color).setTitle(safeText(title, 256)).setTimestamp().setFooter({ text: `𖤐 ${config.serverName} • Zostaw po sobie dobry ślad` });
  if (description) e.setDescription(safeText(description, 4096));
  return e;
}
export function safeText(value, max = 1024) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : (text || '—');
}
export function isBotOwner(memberOrId) {
  const id = typeof memberOrId === 'string' ? memberOrId : memberOrId?.id;
  return Boolean(id && config.ownerIds?.includes(id));
}
export function staffTier(member) {
  if (!member) return 0;
  if (isBotOwner(member)) return 4;
  const has = id => member.roles?.cache?.has(id) ?? false;
  if (member.id === member.guild?.ownerId || has(config.roles.owner)) return 3;
  if (has(config.roles.admin)) return 2;
  if (has(config.roles.helper)) return 1;
  return 0;
}
export function canModerate(actor, target, minimumTier = 1) {
  if (!actor || !target || actor.id === target.id || target.user?.bot || target.id === target.guild?.ownerId || isBotOwner(target)) return false;
  if (staffTier(actor) < minimumTier || staffTier(target) >= staffTier(actor)) return false;
  if (isBotOwner(actor) || actor.id === actor.guild?.ownerId) return true;
  return actor.roles.highest.comparePositionTo(target.roles.highest) > 0;
}
export async function replyError(i, text) {
  const payload = { content: safeText(text, 1900), allowedMentions: { parse: [] } };
  if (i.deferred) return i.editReply(payload);
  if (i.replied) return i.followUp({ ...payload, flags: MessageFlags.Ephemeral });
  return i.reply({ ...payload, flags: MessageFlags.Ephemeral });
}
export function parseDuration(text, { min = 1000, max = 365 * 24 * 3600 * 1000 } = {}) {
  const units = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  const input = String(text).trim().toLowerCase();
  if (!/^(?:\d+\s*[smhdw]\s*)+$/.test(input)) throw new Error('Podaj czas np. 10m, 2h, 7d albo 1h30m.');
  const total = [...input.matchAll(/(\d+)\s*([smhdw])/g)].reduce((sum, [, n, u]) => sum + Number(n) * units[u], 0);
  if (!Number.isSafeInteger(total) || total < min || total > max) throw new Error(`Czas musi mieścić się w zakresie ${min / 1000}–${max / 1000} sekund.`);
  return total;
}
