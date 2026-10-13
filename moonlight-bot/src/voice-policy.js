// Discord permission bits used by the pure access planner (BigInt never becomes a Number).
export const VOICE_FLAGS = Object.freeze({
  ManageChannels: 1n << 4n, ViewChannel: 1n << 10n, SendMessages: 1n << 11n,
  EmbedLinks: 1n << 14n, ReadMessageHistory: 1n << 16n, Connect: 1n << 20n,
  Speak: 1n << 21n, MoveMembers: 1n << 24n, ManageRoles: 1n << 28n,
});

export function normalizeChannelName(value) {
  const name = String(value).replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/gu, '').replace(/\s+/gu, ' ').trim();
  if (!name || name.length > 100) throw new Error('Nazwa kanału musi mieć od 1 do 100 znaków.');
  return name;
}

export function parseVoiceLimit(value) {
  if (!/^\d{1,2}$/.test(String(value).trim())) throw new Error('Limit musi być liczbą od 0 do 99 (0 = bez limitu).');
  return Number(String(value).trim());
}

/** Preserve all unrelated category permissions and rebuild only our managed access. */
export function planOverwrites(base, { guildId, ownerId, botId, staffRoleIds = [], allowedIds = [], blockedIds = [], locked = false, hidden = false }) {
  const F = VOICE_FLAGS;
  const records = new Map(base.map(item => [item.id, { id: item.id, type: item.type, allow: BigInt(item.allow), deny: BigInt(item.deny) }]));
  const get = (id, type = 1) => {
    if (!records.has(id)) records.set(id, { id, type, allow: 0n, deny: 0n });
    return records.get(id);
  };
  const grant = (record, bits) => { record.allow |= bits; record.deny &= ~bits; };
  const deny = (record, bits) => { record.deny |= bits; record.allow &= ~bits; };
  const protectedIds = new Set([ownerId, botId, ...staffRoleIds, ...allowedIds]);
  const mask = (locked ? F.Connect : 0n) | (hidden ? F.ViewChannel : 0n);
  if (mask) {
    deny(get(guildId, 0), mask);
    // An allow on any role overrides @everyone's deny, so remove those allows too.
    for (const record of records.values()) if (!protectedIds.has(record.id)) deny(record, mask);
  }
  for (const id of staffRoleIds) if (id) grant(get(id, 0), F.Connect | F.ViewChannel);
  for (const id of allowedIds) grant(get(id), F.Connect | F.ViewChannel);
  for (const id of blockedIds) if (!protectedIds.has(id)) deny(get(id), F.Connect | F.ViewChannel);
  grant(get(ownerId), F.ViewChannel | F.Connect | F.Speak | F.SendMessages | F.ReadMessageHistory);
  grant(get(botId), F.ViewChannel | F.Connect | F.SendMessages | F.EmbedLinks | F.ReadMessageHistory | F.ManageChannels | F.MoveMembers | F.ManageRoles);
  if (records.size > 100) throw new Error('Za dużo indywidualnych uprawnień kanału (limit Discorda: 100).');
  return [...records.values()].map(item => ({ ...item, allow: item.allow.toString(), deny: item.deny.toString() }));
}

export function createSerialQueue() {
  const queues = new Map();
  return async function run(key, action) {
    const previous = queues.get(key) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(action);
    queues.set(key, next);
    try { return await next; } finally { if (queues.get(key) === next) queues.delete(key); }
  };
}

export function canClaimVoice(row, member, channel) {
  return member.voice?.channelId === channel.id && !channel.members.has(row.owner_id) && !member.user.bot;
}
