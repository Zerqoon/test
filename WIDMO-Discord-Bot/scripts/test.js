import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Tests must never inherit live Railway IDs/roles: that made permission tests
// depend on the deployment environment and caused npm test to fail nondeterministically.
process.env.WIDMO_TEST_FIXTURE = '1';
process.env.DATABASE_PATH = ':memory:';
process.env.GUILD_ID = '123456789012345678';
process.env.OWNER_IDS = '1488470377993736234';
console.log('[test] WIDMO 4.0.3 — deterministic isolated fixture');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = readdirSync(path.join(root, 'test'))
  .filter(file => file.endsWith('.test.js'))
  .sort()
  .map(file => path.join(root, 'test', file));
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit', env: process.env });
if (result.error) { console.error(result.error); process.exit(1); }
process.exit(result.status ?? 1);
