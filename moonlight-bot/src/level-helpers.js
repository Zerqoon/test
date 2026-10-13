import { createHash } from 'node:crypto';

// Total XP required to reach a level. Level 1 = 1,000; level 5 = 10,000.
export function xpForLevel(level) {
  const n = Math.max(0, Math.floor(Number(level) || 0));
  return 250 * n * n + 750 * n;
}

export function levelForXp(xp) {
  const input = Number(xp);
  const value = Number.isFinite(input) ? Math.max(0, input) : 0;
  let level = Math.max(0, Math.floor((-750 + Math.sqrt(562500 + 1000 * value)) / 500));
  while (xpForLevel(level + 1) <= value) level += 1;
  while (xpForLevel(level) > value) level -= 1;
  return level;
}

export function progressForXp(xp) {
  const level = levelForXp(xp);
  return { level, currentXp: xp - xpForLevel(level), neededXp: xpForLevel(level + 1) - xpForLevel(level) };
}

export function qualifiedMessage(content, previous, at, options) {
  const normalized = String(content || '').normalize('NFKC').replace(/\s+/gu, ' ').trim().toLowerCase();
  // Plain text is required: attachment-only posts and strings of punctuation do not farm XP.
  const letters = normalized.match(/[\p{L}\p{N}]/gu) || [];
  if (letters.length < options.minMessageLength) return { qualifies: false };
  const hash = createHash('sha256').update(normalized).digest('hex');
  if (previous?.last_message_at != null && at - previous.last_message_at < options.messageCooldownSeconds * 1000) return { qualifies: false };
  if (previous?.last_message_hash === hash && at - previous.last_message_at < 300_000) return { qualifies: false };
  return { qualifies: true, hash };
}

export function isActiveVoiceMember(member, afkChannelId) {
  const voice = member?.voice;
  return Boolean(member && !member.user?.bot && voice?.channelId && voice.channelId !== afkChannelId
    && !voice.mute && !voice.deaf && !voice.selfMute && !voice.serverMute
    && !voice.selfDeaf && !voice.serverDeaf && !voice.suppress);
}

export function earnedLevelRoles(level, roleMap) {
  return Object.entries(roleMap).filter(([threshold]) => Number(threshold) <= level).map(([, id]) => id);
}

export function accessLevel(statsLevel, roleIds, roleMap) {
  return Object.entries(roleMap).reduce((level, [threshold, roleId]) => roleIds.has(roleId) ? Math.max(level, Number(threshold)) : level, statsLevel);
}

/** Mutates only an in-memory eligibility map; a break or channel change resets the full five minutes. */
export function reconcileVoiceSessions(sessions, eligible, now) {
  for (const [key, session] of sessions) {
    if (eligible.get(key)?.channelId !== session.channelId) sessions.delete(key);
  }
  for (const [key, entry] of eligible) {
    if (!sessions.has(key)) sessions.set(key, { ...entry, since: now });
  }
}
