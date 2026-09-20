import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { commandPayload } from '../src/commands.js';
import { commandMeta, categories } from '../src/command-meta.js';
import { helpPayload } from '../src/public-panels.js';
import { config } from '../src/config.js';

let failures=0;
for(const dir of ['src','scripts','tests'])for(const file of readdirSync(dir).filter(f=>f.endsWith('.js'))){
  const checked=spawnSync(process.execPath,['--check',`${dir}/${file}`],{encoding:'utf8'});
  if(checked.status!==0){failures++;console.error(checked.stderr);}
  if(/r3v[0o]/i.test(readFileSync(`${dir}/${file}`,'utf8'))){failures++;console.error(`Stary branding: ${dir}/${file}`);}
}
if(new Set(commandPayload.map(c=>c.name)).size!==commandPayload.length)throw new Error('Powtórzona nazwa komendy');
if(commandPayload.length!==Object.keys(commandMeta).length)throw new Error('Katalog pomocy nie obejmuje wszystkich komend');
for(const tier of [0,1,2,3]){
  const interaction={user:{id:'u'},guild:{ownerId:'owner'},member:{roles:{cache:new Set(tier===3?[config.roles.chief]:tier===2?[config.roles.moderator]:tier===1?[config.roles.helper]:[])}}};
  for(const category of Object.keys(categories))for(const card of helpPayload(interaction,category).embeds){
    const json=card.toJSON();
    const length=JSON.stringify(json).length;
    if(length>5800)throw new Error(`Pomoc za długa: ${category}`);
  }
}
console.log(`${commandPayload.length} komend; składnia, opisy i limity pomocy: ${failures?'BŁĘDY':'OK'}`);
process.exitCode=failures?1:0;
