/** Select only eligible bot backups for retention cleanup. Does not touch the filesystem. */
export function selectBackupDeletions(backups, {
  now = Date.now(),
  maxBackups = 20,
  maxAgeMs = 14 * 24 * 60 * 60 * 1000,
  currentFile = null,
} = {}) {
  const limit = Math.max(1, Math.floor(Number(maxBackups) || 20));
  const maxAge = Math.max(1, Number(maxAgeMs) || 1);
  const ordered = [...backups]
    .filter(item => item && typeof item.file === 'string' && Number.isFinite(item.mtimeMs))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return ordered.filter((item, index) => {
    if (item.file === currentFile) return false;
    return now - item.mtimeMs > maxAge || index >= limit;
  }).map(item => item.file);
}
