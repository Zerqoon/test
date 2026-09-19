export const totalXpForLevel = level => 60 * level + 35 * level * level;

export function levelForXp(xp) {
  let lo = 0, hi = 1;
  while (totalXpForLevel(hi) <= xp) hi *= 2;
  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (totalXpForLevel(mid) <= xp) lo = mid;
    else hi = mid;
  }
  return lo;
}

export function progressForXp(xp) {
  const level = levelForXp(xp);
  const start = totalXpForLevel(level);
  const next = totalXpForLevel(level + 1);
  return { level, current: xp - start, required: next - start, fraction: (xp - start) / (next - start) };
}

export function multiplierFor(member, profile, config, now = Date.now()) {
  const roleBoost = member.roles.cache.has(config.roles.booster) ? config.xp.boosterRoleMultiplier : 1;
  const itemBoost = profile.booster_until > now ? config.xp.purchasedMultiplier : 1;
  return roleBoost * itemBoost;
}
