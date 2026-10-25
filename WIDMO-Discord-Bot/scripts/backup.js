import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';
import { selectBackupDeletions } from '../src/backup-policy.js';

const MAX_BACKUPS = Math.max(1, Number(process.env.BACKUP_RETENTION_COUNT || 20));
const MAX_AGE_MS = Math.max(1, Number(process.env.BACKUP_RETENTION_DAYS || 14)) * 24 * 60 * 60 * 1000;

if (config.databasePath === ':memory:') throw new Error('Nie można tworzyć trwałej kopii bazy dla DATABASE_PATH=:memory:.');
const source = new DatabaseSync(config.databasePath, { readOnly: true });
const folder = path.join(path.dirname(config.databasePath), 'backups');
mkdirSync(folder, { recursive: true });
const output = path.join(folder, `bot-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
try {
  await backup(source, output);
  console.log(`Zapisano spójną kopię bazy: ${output}`);
} finally {
  source.close();
}

// Keep the volume from growing forever. Only timestamped bot backup files are eligible.
const now = Date.now();
const backups = readdirSync(folder)
  .filter(name => /^bot-[\dTZ-]+\.sqlite$/.test(name))
  .map(name => {
    const file = path.join(folder, name);
    try { return { file, mtimeMs: statSync(file).mtimeMs }; }
    catch { return null; }
  })
  .filter(Boolean);
const deletions = selectBackupDeletions(backups, {
  now, maxBackups: MAX_BACKUPS, maxAgeMs: MAX_AGE_MS, currentFile: output,
});
let removed = 0;
for (const file of deletions) {
  try { unlinkSync(file); removed++; }
  catch (error) { console.error(`[backup] Nie udało się usunąć starej kopii ${file}:`, error.message); }
}
if (removed) console.log(`[backup] Usunięto ${removed} starych kopii (limit ${MAX_BACKUPS}, maks. ${Math.round(MAX_AGE_MS / 86_400_000)} dni).`);
