import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { config, ROOT } from '../src/config.js';
const source = new DatabaseSync(config.databasePath, { readOnly: true });
const folder = path.join(ROOT,'backups'); mkdirSync(folder,{recursive:true});
const output = path.join(folder, `bot-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`);
try { await backup(source,output);console.log(`Zapisano spójną kopię bazy: ${output}`); } finally { source.close(); }
