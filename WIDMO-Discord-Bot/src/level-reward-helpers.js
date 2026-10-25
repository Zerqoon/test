const SNOWFLAKE = /^\d{17,20}$/;

export function normalizeLevelRewards(levels = {}, retiredLevelRoles = []) {
  if (!levels || typeof levels !== 'object' || Array.isArray(levels)) {
    throw new Error('Mapa nagród poziomów musi być obiektem.');
  }
  const normalized = {};
  for (const [rawLevel, rawRoleId] of Object.entries(levels)) {
    const level = Number(rawLevel);
    const roleId = String(rawRoleId ?? '');
    if (!Number.isInteger(level) || level < 1 || level > 1000) throw new Error(`Nieprawidłowy próg poziomu: ${rawLevel}. Użyj liczby 1–1000.`);
    if (!SNOWFLAKE.test(roleId)) throw new Error(`Nieprawidłowe ID roli dla poziomu ${level}.`);
    if (Object.hasOwn(normalized, String(level))) throw new Error(`Powtórzony próg poziomu ${level}.`);
    normalized[String(level)] = roleId;
  }
  const activeIds = new Set(Object.values(normalized));
  const retired = [...new Set((Array.isArray(retiredLevelRoles) ? retiredLevelRoles : []).map(String))]
    .filter(id => SNOWFLAKE.test(id) && !activeIds.has(id));
  return {
    levels: Object.fromEntries(Object.entries(normalized).sort((a, b) => Number(a[0]) - Number(b[0]))),
    retiredLevelRoles: retired,
  };
}

export function setLevelReward(levels = {}, retiredLevelRoles = [], level, roleId) {
  const threshold = Number(level);
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 1000) {
    throw new Error('Poziom musi być liczbą całkowitą od 1 do 1000.');
  }
  const id = String(roleId ?? '');
  if (!SNOWFLAKE.test(id)) throw new Error('ID roli jest nieprawidłowe.');
  const current = normalizeLevelRewards(levels, retiredLevelRoles);
  const nextLevels = { ...current.levels, [String(threshold)]: id };
  const nextActive = new Set(Object.values(nextLevels));
  const oldRole = current.levels[String(threshold)];
  const retired = new Set(current.retiredLevelRoles.filter(retiredId => !nextActive.has(retiredId)));
  if (oldRole && oldRole !== id && !nextActive.has(oldRole)) retired.add(oldRole);
  retired.delete(id);
  return normalizeLevelRewards(nextLevels, [...retired]);
}

export function removeLevelReward(levels = {}, retiredLevelRoles = [], level) {
  const threshold = Number(level);
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 1000) {
    throw new Error('Poziom musi być liczbą całkowitą od 1 do 1000.');
  }
  const current = normalizeLevelRewards(levels, retiredLevelRoles);
  const oldRole = current.levels[String(threshold)];
  if (!oldRole) throw new Error(`Nie ma skonfigurowanej nagrody dla poziomu ${threshold}.`);
  const nextLevels = { ...current.levels };
  delete nextLevels[String(threshold)];
  const active = new Set(Object.values(nextLevels));
  const retired = new Set(current.retiredLevelRoles);
  if (!active.has(oldRole)) retired.add(oldRole);
  return { ...normalizeLevelRewards(nextLevels, [...retired]), removedRoleId: oldRole };
}

export function levelRoleDiff(level, memberRoleIds, levels = {}, retiredLevelRoles = []) {
  const owned = memberRoleIds instanceof Set ? memberRoleIds : new Set(memberRoleIds ?? []);
  const normalized = normalizeLevelRewards(levels, retiredLevelRoles);
  const earned = [...new Set(Object.entries(normalized.levels)
    .filter(([threshold]) => Number(threshold) <= Number(level))
    .map(([, id]) => id))];
  const managed = new Set([...Object.values(normalized.levels), ...normalized.retiredLevelRoles]);
  return {
    add: earned.filter(id => !owned.has(id)),
    remove: [...managed].filter(id => !earned.includes(id) && owned.has(id)),
  };
}
