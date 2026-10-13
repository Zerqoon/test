import { randomInt } from 'node:crypto';

/** Fisher–Yates with crypto.randomInt: each eligible entrant has equal odds. */
export function chooseWinners(userIds, count, random = randomInt) {
  const pool = [...new Set(userIds)];
  const amount = Math.min(Math.max(0, Math.floor(count)), pool.length);
  for (let i = 0; i < amount; i += 1) {
    const j = random(i, pool.length);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, amount);
}

export function giveawayEligibility(member, roleId, minMessages, messages) {
  if (!member || member.user.bot) return 'W giveaway mogą brać udział wyłącznie obecni użytkownicy serwera.';
  if (roleId && !member.roles.cache.has(roleId)) return `Wymagana rola: <@&${roleId}>.`;
  if (messages < minMessages) return `Wymagane ${minMessages} poprawnych wiadomości. Masz ${messages}.`;
  return null;
}

export function banReason(actorId, reason, marker = null) {
  const suffix = ` | moderator:${actorId}${marker ? ` | auto:${marker}` : ''}`;
  return `${reason.slice(0, 500 - suffix.length)}${suffix}`;
}

export function isManagedBan(reason, marker) {
  return typeof reason === 'string' && reason.endsWith(` | auto:${marker}`);
}
