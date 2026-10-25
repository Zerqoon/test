import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.WIDMO_TEST_FIXTURE = '1';
process.env.DATABASE_PATH = ':memory:';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = readdirSync(path.join(root, 'test'))
  .filter(file => file.endsWith('.test.js'))
  .sort()
  .map(file => path.join(root, 'test', file));
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit', env: process.env });
if (result.error) { console.error(result.error); process.exit(1); }
process.exit(result.status ?? 1);
