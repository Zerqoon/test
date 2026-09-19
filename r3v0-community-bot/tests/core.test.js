import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/db.js';
import { levelForXp, totalXpForLevel, multiplierFor } from '../src/level.js';
import { config } from '../src/config.js';
import { profileCard, economyCard, rankCard, topCard } from '../src/cards.js';
import { commandPayload } from '../src/commands.js';

function fixture(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'r3v0-test-'));
  const db=new Store(dir);
  t.after(()=>{db.close();fs.rmSync(dir,{recursive:true,force:true});});
  return db;
}

test('Poziomy mają poprawny próg i nagradzają tylko nowe poziomy',t=>{
  const db=fixture(t),need=totalXpForLevel(5);
  assert.equal(levelForXp(need-1),4);
  assert.equal(levelForXp(need),5);
  const result=db.changeXp('guild','alice',need);
  assert.equal(result.level,5);
  assert.equal(result.bonus,75*(1+2+3+4+5));
  assert.equal(db.changeXp('guild','alice',1).bonus,0);
  assert.equal(db.setXp('guild','alice',0).level,0);
});

test('Antyspam zachowuje cooldown i tekst, XP w VC liczy dopiero pełną minutę',t=>{
  const db=fixture(t),cfg={messageCooldownMs:45000,repeatCooldownMs:300000};
  assert.ok(db.grantMessageXp('guild','alice','wiadomość',14,cfg,1_000_000));
  assert.equal(db.grantMessageXp('guild','alice','inna wiadomość',14,cfg,1_001_000),null);
  assert.equal(db.grantMessageXp('guild','alice','WIADOMOŚĆ',14,cfg,1_050_000),null);
  assert.ok(db.grantMessageXp('guild','alice','inna wiadomość',14,cfg,1_100_000));
  assert.equal(db.grantVoiceTime('guild','alice',35,8),null);
  const result=db.grantVoiceTime('guild','alice',25,8);
  assert.equal(result.gained,8);
  assert.equal(db.user('guild','alice').voice_seconds,60);
});

test('Booster i sklepowy bonus stosują łączny mnożnik 3×',t=>{
  const db=fixture(t),user='alice';
  db.changeBalance('guild',user,2000);
  assert.equal(db.buy('guild',user,'xp_boost'),true);
  assert.equal(db.use('guild',user,'xp_boost',1_000_000),true);
  const row=db.user('guild',user);
  const member={roles:{cache:{has:id=>id===config.roles.booster}}};
  assert.equal(multiplierFor(member,row,config,1_000_001),3);
  assert.equal(multiplierFor(member,row,config,5_000_001),2);
});

test('Monety, przelewy i zakłady nie pozwalają zejść poniżej zera',t=>{
  const db=fixture(t);
  db.changeBalance('guild','alice',100);
  assert.equal(db.transfer('guild','alice','bob',101),false);
  assert.equal(db.transfer('guild','alice','bob',40),true);
  assert.equal(db.wager('guild','alice',61,0),false);
  assert.equal(db.wager('guild','alice',20,40),80);
  assert.equal(db.user('guild','bob').balance,40);
  assert.equal(db.claim('guild','bob','daily',86400000,350,1_000_000_000).ok,true);
  assert.equal(db.claim('guild','bob','daily',86400000,350,1_000_001_000).ok,false);
});

test('Pokoje, ostrzeżenia i snapshoty pozostają w bazie po otwarciu jej ponownie',t=>{
  const db=fixture(t),dir=path.dirname(db.db.name);
  db.saveRoom('guild','channel','alice');
  const id=db.addWarning('guild','bob','alice','Powód');
  db.saveMessage({id:'msg',guildId:'guild',channelId:'channel',author:{id:'bob'},content:'treść',attachments:new Map()});
  const second=new Store(dir);
  t.after(()=>second.close());
  assert.equal(second.room('channel').owner_id,'alice');
  assert.equal(second.warnings('guild','bob')[0].id,Number(id));
  assert.equal(second.snapshot('msg').content,'treść');
  assert.equal(second.removeWarning('guild',Number(id)),true);
});

test('Karty graficzne zwracają prawidłowe PNG, komendy mają unikalne nazwy',async()=>{
  const user={name:'B3sttiee',username:'b3sttiee'},row={xp:2823,balance:2019,messages:12,voice_seconds:126,title:'CIEŃ NOCY'};
  const imgs=[await profileCard(user,row,4,'Adept'),await rankCard(user,row,4),await economyCard(user,row,4),await topCard([{...row,user_id:'abc'}],[user])];
  for(const png of imgs){assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.ok(png.length>20000);}
  assert.equal(commandPayload.length,40);
  assert.equal(new Set(commandPayload.map(c=>c.name)).size,commandPayload.length);
});
