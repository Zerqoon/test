import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
process.env.DATABASE_PATH=':memory:';
process.env.GUILD_ID='123456789012345678';
const { config } = await import('../src/config.js');
const { db } = await import('../src/db.js');
const { handleUtilityCommand } = await import('../src/utility-commands.js');
const { getStats, setMemberXp, installLevels } = await import('../src/levels.js');
const { xpForLevel } = await import('../src/level-helpers.js');
function environment() {
  const users=new Map(), roleMap=new Map(Object.values(config.roles.levels).map(id=>[id,{id,editable:true}]));
  const client=new EventEmitter(); client.isReady=()=>true; client.ws={ping:42};
  const guild={id:config.guildId,ownerId:'111111111111111111',available:true,channels:{cache:new Map()},roles:{cache:roleMap,fetch:async id=>roleMap.get(id)}};
  guild.members={fetch:async ref=>{const m=users.get(typeof ref==='string'?ref:ref.user); if(!m)throw Object.assign(new Error('Unknown member'),{code:10007});return m;}};
  client.guilds={cache:new Map([[guild.id,guild]])};
  client.channels={fetch:async()=>({guildId:guild.id,isTextBased:()=>true,send:async()=>{}})};
  function member(id,role=null){const m={id,guild,user:{id,bot:false,username:'Tester'},roles:{cache:new Map(role?[[role,roleMap.get(role)??{id:role}]]:[]),highest:{position:1,comparePositionTo:()=>0}}};
    m.roles.add=async id=>m.roles.cache.set(id,roleMap.get(id));m.roles.remove=async id=>m.roles.cache.delete(id);users.set(id,m);return m;}
  const owner=member(config.ownerIds[0]);
  const target=member('333333333333333333');
  function interaction(name,values={},actor=owner){return{commandName:name,guild,guildId:guild.id,client,user:actor.user,member:actor,replies:[],
    isChatInputCommand:()=>true,options:{getUser:k=>values[k],getInteger:k=>values[k],getString:k=>values[k],getSubcommand:()=>values.sub},
    async deferReply(){this.deferred=true;},async editReply(v){this.replies.push(v);},async followUp(v){this.replies.push(v);},async reply(v){this.replies.push(v);}};}
  return{client,guild,member,owner,target,roleMap,interaction};
}
async function until(fn){for(let n=0;n<100;n++){if(fn())return;await new Promise(r=>setTimeout(r,5));}assert.fail('Role reconciliation did not settle');}
function reset(){db.exec('DELETE FROM level_role_jobs;DELETE FROM level_announcements;DELETE FROM level_stats;');}
test('owner without roles adjusts fractional XP without forging messages or changing cooldowns',async()=>{
  reset();const e=environment();
  db.prepare('INSERT INTO level_stats(guild_id,user_id,xp,messages,last_message_at) VALUES(?,?,?,?,?)').run(config.guildId,e.target.id,12.5,4,12345);
  const i=e.interaction('xp',{sub:'dodaj',osoba:e.target.user,ilosc:100,powod:'Korekta'});await handleUtilityCommand(i);
  const row=db.prepare('SELECT * FROM level_stats WHERE user_id=?').get(e.target.id);
  assert.equal(row.xp,112.5);assert.equal(row.messages,4);assert.equal(row.last_message_at,12345);
  assert.equal(db.prepare('SELECT sync_exact FROM level_role_jobs WHERE user_id=?').get(e.target.id).sync_exact,1);
  assert.match(i.replies.at(-1).embeds[0].data.description,/112.5/);
});
test('moderator cannot edit XP and permission report recognizes configured owner ID',async()=>{
  reset();const e=environment(),moderator=e.member('444444444444444444',config.roles.moderator);
  const denied=e.interaction('xp',{sub:'ustaw',osoba:e.target.user,ilosc:10000,powod:'Nie wolno'},moderator);await handleUtilityCommand(denied);
  assert.equal(getStats(config.guildId,e.target.id).xp,0);assert.match(denied.replies.at(-1).content,/wymaga/);
  const access=e.interaction('uprawnienia');await handleUtilityCommand(access);assert.match(access.replies.at(-1).embeds[0].data.description,/dostęp po ID/);
});
test('decreasing XP removes only obsolete milestone roles and preserves unrelated roles',async()=>{
  reset();const e=environment();
  db.prepare('INSERT INTO level_stats(guild_id,user_id,xp,messages) VALUES(?,?,?,?)').run(config.guildId,e.target.id,xpForLevel(20),9);
  for(const level of [5,10,20])e.target.roles.cache.set(config.roles.levels[level],e.roleMap.get(config.roles.levels[level]));
  e.target.roles.cache.set('unrelated',{id:'unrelated'});
  const services=installLevels(e.client);
  try{
    await until(()=>!db.prepare('SELECT 1 FROM level_role_jobs').get());
    await setMemberXp(e.target,xpForLevel(5));
    await until(()=>!db.prepare('SELECT 1 FROM level_role_jobs').get());
    assert.equal(e.target.roles.cache.has(config.roles.levels[5]),true);
    assert.equal(e.target.roles.cache.has(config.roles.levels[10]),false);
    assert.equal(e.target.roles.cache.has(config.roles.levels[20]),false);
    assert.equal(e.target.roles.cache.has('unrelated'),true);assert.equal(getStats(config.guildId,e.target.id).messages,9);
  }finally{services.stop();}
});
test('failed role correction remains durable and is repaired after a restart',async()=>{
  reset();const e=environment();e.target.roles.cache.set(config.roles.levels[10],e.roleMap.get(config.roles.levels[10]));
  e.roleMap.get(config.roles.levels[10]).editable=false;
  await setMemberXp(e.target,0);let services=installLevels(e.client);
  try{await until(()=>db.prepare('SELECT attempts FROM level_role_jobs WHERE user_id=?').get(e.target.id)?.attempts===1);}finally{services.stop();}
  assert.equal(getStats(config.guildId,e.target.id).xp,0);assert.equal(e.target.roles.cache.has(config.roles.levels[10]),true);
  e.roleMap.get(config.roles.levels[10]).editable=true;db.prepare('UPDATE level_role_jobs SET next_attempt=0').run();services=installLevels(e.client);
  try{await until(()=>!db.prepare('SELECT 1 FROM level_role_jobs').get());assert.equal(e.target.roles.cache.has(config.roles.levels[10]),false);}finally{services.stop();}
});
test('level setter uses progression formula and XP arithmetic rejects out-of-range totals',async()=>{
  reset();const e=environment();const level=e.interaction('ustaw-poziom',{osoba:e.target.user,poziom:10,powod:'Przywrócenie'});await handleUtilityCommand(level);
  assert.equal(getStats(config.guildId,e.target.id).xp,32500);assert.equal(getStats(config.guildId,e.target.id).level,10);
  const invalid=e.interaction('xp',{sub:'dodaj',osoba:e.target.user,ilosc:10000000,powod:'Za dużo'});await handleUtilityCommand(invalid);
  assert.equal(getStats(config.guildId,e.target.id).xp,32500);assert.match(invalid.replies.at(-1).content,/10 000 000/);
});
