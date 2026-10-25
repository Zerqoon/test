import { spawnSync } from 'node:child_process';
process.env.WIDMO_TEST_FIXTURE = '1';
// Keep tests isolated from the production or local persistent database.
process.env.DATABASE_PATH = ':memory:';
const result = spawnSync(process.execPath, ['--test'], { stdio: 'inherit', env: process.env });
if (result.error) { console.error(result.error); process.exit(1); }
process.exit(result.status ?? 1);
