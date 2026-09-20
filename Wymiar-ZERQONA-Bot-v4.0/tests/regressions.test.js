import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { Collection, PermissionFlagsBits as P, PermissionsBitField, ChannelType } from 'discord.js';
import { Store } from '../src/db.js';
import { profileCard } from '../src/cards.js';
import { items } from '../src/shop.js';
import { totalXpForLevel, multiplierFor } from '../src/level.js';
import { config } from '../src/config.js';
import { commandMeta } from '../src/command-meta.js';
import { commandPayload } from '../src/commands.js';
import { handlePublic } from '../src/commands-public.js';
import { handleAdmin } from '../src/commands-admin.js';
import { activate, handleAutocomplete, handlePublicComponent, helpPayload, purchase, showTop, shopPayload, showInventory } from '../src/public-panels.js';
import { seedVoiceSweep, voiceXpSweep } from '../src/experience.js';

const G='100000000000000001',A='100000000000000002',B='100000000000000003';
function fixture(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zerqona-regression-')),db=new Store(dir);
  t.after(()=>{db.close();fs.rmSync(dir,{recursive:true,force:true});});return db;
}
function interaction(name,values={},tier=3){
  const sent=[],roles=new Collection();
  const all=new PermissionsBitField(Object.values(P));
  if(tier)roles.set(tier===3?config.roles.chief:tier===2?config.roles.moderator:config.roles.helper,{});
  const user=id=>({id,bot:false,username:id===A?'B3sttiee':'Gość',createdTimestamp:1_500_000_000_000,displayAvatarURL:()=> 'https://example.com/avatar.png'});
  const guild={id:G,name:'Wymiar ZERQONA',ownerId:'owner',memberCount:5,premiumTier:1,premiumSubscriptionCount:2,createdTimestamp:1_600_000_000_000,iconURL:()=>null};
  const member=id=>({id,user:user(id),guild,displayName:id===A?'B3sttiee':'Gość',joinedTimestamp:1_700_000_000_000,displayAvatarURL:()=> 'https://example.com/avatar.png',
    permissions:all,roles:{cache:id===A?roles:new Collection(),highest:{comparePositionTo:()=>1},add:async()=>{},remove:async()=>{}},voice:{channelId:null},
    moderatable:true,kickable:true,bannable:true,communicationDisabledUntilTimestamp:Date.now()+60000,timeout:async()=>{},kick:async()=>{},ban:async()=>{}});
  const members=new Collection([[A,member(A)],[B,member(B)]]);
  guild.members={cache:members,fetch:async id=>members.get(id)||null,fetchMe:async()=>guild.members.me,me:{permissions:all,roles:{highest:{comparePositionTo:()=>1},cache:new Collection()}}};
  guild.roles={cache:new Collection(config.levelRoles.map(r=>[r.id,{...r,editable:true}])),fetch:async()=>{}};
  const overwrites=new Collection();
  const channel={id:'200000000000000001',guild,type:ChannelType.GuildText,bulkDelete:async()=>new Collection([['m1',{}]]),setRateLimitPerUser:async()=>{},
    permissionOverwrites:{cache:overwrites,edit:async(id,patch)=>{channel.lastPatch=patch;return channel;}}};
  guild.channels={cache:new Collection(),fetch:async()=>null};
  guild.bans={fetch:async()=>({}),remove:async()=>{}};
  const i={commandName:name,user:user(A),member:members.get(A),guild,guildId:G,channel,channelId:channel.id,appPermissions:all,
    client:{ws:{ping:24},users:{cache:new Collection([[A,user(A)],[B,user(B)]]),fetch:async()=>null}},
    options:{getUser:k=>values[k]||null,getString:k=>values[k]??null,getInteger:k=>values[k]??null,getBoolean:k=>values[k]??null,getSubcommand:()=>values.sub||'dodaj',getRole:()=>({id:'role',name:'rola',position:1,editable:true,managed:false}),getFocused:()=>values.focused||''},
    isButton:()=>false,isStringSelectMenu:()=>false,isAutocomplete:()=>false,inGuild:()=>true,
    async reply(body){assert.ok(!this.deferred&&!this.replied);this.replied=true;sent.push(body);},
    async deferReply(body){assert.ok(!this.replied&&!this.deferred);this.deferred=true;this.deferBody=body;this.ephemeral=Boolean(body?.flags&64);},
    async editReply(body){assert.ok(this.deferred||this.replied);sent.push(body);},
    async followUp(body){sent.push(body);},async deferUpdate(){this.deferred=true;},async update(body){this.replied=true;sent.push(body);},async respond(body){sent.push(body);},
    async fetchReply(){return {react:async()=>{}};},sent,
  };
  i.deferred=false;i.replied=false;return i;
}

test('Daily: 24 h cooldown, seria 7 dni, limit bonusu i reset po 48 h',t=>{
  const db=fixture(t),start=2_000_000_000,cfg=config.economy;
  assert.equal(db.claim(G,A,'daily',cfg.dailyCooldownMs,350,start).reward,350);
  assert.equal(db.claim(G,A,'daily',cfg.dailyCooldownMs,350,start+cfg.dailyCooldownMs-1).ok,false);
  for(let day=1;day<=8;day++)assert.equal(db.claim(G,A,'daily',cfg.dailyCooldownMs,350,start+day*cfg.dailyCooldownMs).reward,Math.min(650,350+day*50));
  assert.equal(db.claim(G,A,'daily',cfg.dailyCooldownMs,350,start+11*cfg.dailyCooldownMs).streak,1);
  assert.equal(db.history(G,A,15).length,10);
});
test('Tytuły są trwałe; ponowny zakup nie pobiera monet; boosty czasowe wydłużają czas',t=>{
  const db=fixture(t);db.setBalance(G,A,20000);
  assert.equal(purchase(db,G,A,'title_shadow').ok,true);
  const balance=db.user(G,A).balance;
  assert.equal(purchase(db,G,A,'title_shadow').ok,false);assert.equal(db.user(G,A).balance,balance);
  for(let n=0;n<3;n++){assert.equal(activate(db,G,A,'title_shadow').ok,true);db.clearTitle(G,A);}
  assert.equal(db.inventory(G,A)[0].quantity,1);
  db.buy(G,A,'xp_boost');db.buy(G,A,'xp_boost');
  db.use(G,A,'xp_boost',1_000_000);db.use(G,A,'xp_boost',1_000_000);
  assert.equal(db.user(G,A).booster_until,8_200_000);
  assert.equal(db.use(G,A,'xp_boost'),false);
  assert.equal(purchase(db,G,A,'__proto__').ok,false);
});
test('Korekty XP nie wypłacają monet; cofnięcie i odzyskanie poziomu nie mnoży nagród',t=>{
  const db=fixture(t),xp=totalXpForLevel(5),cfg=config.xp;
  const earned=db.grantMessageXp(G,A,'pierwszy awans',xp,cfg,1_000_000);
  assert.equal(earned.bonus,1125);db.setXp(G,A,0);
  assert.equal(db.grantMessageXp(G,A,'ponowny awans',xp,cfg,2_000_000).bonus,0);
  assert.equal(db.user(G,A).balance,1125);
  assert.equal(db.setXp(G,A,totalXpForLevel(10)).bonus,0);
  assert.equal(db.user(G,A).rewarded_level,10);
});
test('Historia przelewów zachowuje sumę sald i nie zapisuje nieudanej płatności',t=>{
  const db=fixture(t);db.setBalance(G,A,100);
  assert.equal(db.transfer(G,A,B,101),false);
  assert.equal(db.transfer(G,A,B,NaN),false);
  assert.equal(db.transfer(G,A,B,55),true);
  assert.equal(db.user(G,A).balance+db.user(G,B).balance,100);
  assert.equal(db.history(G,A)[0].amount,-55);assert.equal(db.history(G,B)[0].amount,55);
  assert.throws(()=>db.setBalance(G,A,Infinity),RangeError);
  db.setBalance(G,B,1_000_000_000_000);
  assert.throws(()=>db.transfer(G,A,B,1),RangeError);
  assert.equal(db.user(G,A).balance,45);
});
test('Migracja bazy v1 zachowuje saldo, XP i aktywny wcześniej zużyty tytuł',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zerqona-migration-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const old=new Database(path.join(dir,'community.sqlite'));
  old.exec(`CREATE TABLE users (
    guild_id TEXT NOT NULL,user_id TEXT NOT NULL,xp INTEGER DEFAULT 0,balance INTEGER DEFAULT 0,messages INTEGER DEFAULT 0,voice_seconds INTEGER DEFAULT 0,vc_remainder INTEGER DEFAULT 0,
    last_message_at INTEGER DEFAULT 0,last_message_hash TEXT DEFAULT '',last_repeat_at INTEGER DEFAULT 0,last_daily_at INTEGER DEFAULT 0,last_work_at INTEGER DEFAULT 0,booster_until INTEGER DEFAULT 0,title TEXT DEFAULT '',PRIMARY KEY(guild_id,user_id));
    CREATE TABLE inventory(guild_id TEXT,user_id TEXT,item_id TEXT,quantity INTEGER,PRIMARY KEY(guild_id,user_id,item_id));`);
  old.prepare('INSERT INTO users (guild_id,user_id,xp,balance,title) VALUES (?,?,?,?,?)').run(G,A,totalXpForLevel(8),12345,'CIEŃ NOCY');
  old.prepare('INSERT INTO inventory VALUES (?,?,?,0)').run(G,A,'title_shadow');old.close();
  const db=new Store(dir);t.after(()=>db.close());
  assert.equal(db.user(G,A).balance,12345);assert.equal(db.user(G,A).rewarded_level,8);
  assert.equal(db.inventory(G,A)[0].quantity,1);assert.equal(db.user(G,A).daily_streak,0);
  db.setXp(G,A,0);assert.equal(db.grantMessageXp(G,A,'awans',totalXpForLevel(8),config.xp).bonus,0);
});
test('Rankingi: deterministyczne remisy, strony, dozwolone kolumny',t=>{
  const db=fixture(t);for(let n=0;n<23;n++)db.setBalance(G,String(n).padStart(3,'0'),100);
  assert.equal(db.top(G,'balance',10,10)[0].user_id,'010');assert.equal(db.rank(G,'012','balance'),13);
  assert.equal(db.top(G,'messages',10,20).length,3);assert.throws(()=>db.top(G,'balance; DROP TABLE users'));
});
test('Każda z 52 komend ma pomoc; ustawienie XP i monet dopuszcza zero',()=>{
  assert.deepEqual(new Set(commandPayload.map(c=>c.name)),new Set(Object.keys(commandMeta)));
  for(const name of ['xp','monety_admin']){
    const c=commandPayload.find(c=>c.name===name);assert.equal(c.options.find(o=>o.name==='ustaw').options.find(o=>o.name==='ilosc').min_value,0);
  }
  const novice=interaction('pomoc',{},0);
  const fields=helpPayload(novice,'moderacja').embeds[0].toJSON().fields;
  assert.ok(fields.some(x=>x.name==='/ostrzezenia'));assert.match(fields.find(x=>x.name==='/ban').value,/Moderator/);
});
test('Podpowiedzi /uzyj zawierają wyłącznie posiadane przedmioty',async t=>{
  const db=fixture(t);db.setBalance(G,A,4000);db.buy(G,A,'title_shadow');
  const i=interaction('uzyj');await handleAutocomplete(i,db);
  assert.deepEqual(i.sent[0].map(o=>o.value),['title_shadow']);
});
test('Cudzy przycisk sklepu nie wykonuje transakcji',async t=>{
  const db=fixture(t);db.setBalance(G,A,4000);
  const i=interaction('');i.isButton=()=>true;i.customId=`wz:buy:${B}:xp_boost`;
  assert.equal(await handlePublicComponent(i,db),true);assert.equal(db.user(G,A).balance,4000);assert.equal(db.inventory(G,A).length,0);
});
test('Przyciski Kup/Użyj działają i blokują szybkie powtórzenie',async t=>{
  const db=fixture(t);db.setBalance(G,A,5000);
  const i=interaction('');i.isButton=()=>true;i.customId=`wz:buy:${A}:title_shadow`;
  assert.equal(await handlePublicComponent(i,db),true);assert.equal(db.user(G,A).balance,2000);assert.equal(i.sent.length,2);
  const repeat=interaction('');repeat.isButton=()=>true;repeat.customId=`wz:buy:${A}:xp_boost`;
  await handlePublicComponent(repeat,db);assert.equal(db.user(G,A).balance,2000);
});
test('Ranking z numerem strony poza zakresem pokazuje ostatnią poprawną stronę',async t=>{
  const db=fixture(t);db.setBalance(G,A,100);
  const i=interaction('top');await showTop(i,db,'balance',999);
  assert.match(i.sent[0].content,/1\/1/);assert.equal(i.sent[0].files.length,1);
});
test('Blokada kanału odtwarza wcześniejsze jawne zezwolenie, również po restarcie',async t=>{
  const db=fixture(t),lock=interaction('zamknij');
  lock.channel.permissionOverwrites.cache.set(G,{allow:new PermissionsBitField(P.SendMessages),deny:new PermissionsBitField()});
  await handleAdmin(lock,db);assert.equal(lock.channel.lastPatch.SendMessages,false);
  const reopened=new Store(path.dirname(db.db.name));t.after(()=>reopened.close());
  const open=interaction('otworz');await handleAdmin(open,reopened);assert.equal(open.channel.lastPatch.SendMessages,true);assert.equal(reopened.channelLock(open.channelId),undefined);
});
test('Brak roli lub uprawnienia bota nie usuwa wiadomości',async t=>{
  const db=fixture(t);let deleted=0;
  for(const tier of [0,1]){
    const i=interaction('wyczysc',{ilosc:10},tier);i.appPermissions=new PermissionsBitField();i.channel.bulkDelete=async()=>{deleted++;};
    assert.equal(await handleAdmin(i,db),true);assert.equal(i.sent.length,1);
  }
  assert.equal(deleted,0);
});
test('Wyjście z aktywnego VC rozlicza czas, AFK i samotne VC nie dają XP',async t=>{
  const db=fixture(t),original=config.guildId;config.guildId=G;t.after(()=>{config.guildId=original;});
  const i=interaction(''),guild=i.guild,alice=guild.members.cache.get(A),bob=guild.members.cache.get(B);
  const vc={id:'vc',type:2,isVoiceBased:()=>true,members:new Collection([[A,alice],[B,bob]])};
  alice.voice={channelId:'vc',deaf:false,selfDeaf:false};bob.voice={channelId:'vc',deaf:false,selfDeaf:false};
  guild.channels.cache.set('vc',vc);const client={guilds:{cache:new Collection([[G,guild]])}};
  seedVoiceSweep(client,1_000_000);await voiceXpSweep(client,db,1_060_000);
  assert.equal(db.user(G,A).xp,8);
  vc.members.delete(B);bob.voice.channelId=null;await voiceXpSweep(client,db,1_070_000);
  await voiceXpSweep(client,db,1_130_000);assert.equal(db.user(G,A).voice_seconds,70);
  guild.afkChannelId='vc';vc.members.set(B,bob);bob.voice.channelId='vc';await voiceXpSweep(client,db,1_140_000);
  await voiceXpSweep(client,db,1_200_000);assert.equal(db.user(G,A).voice_seconds,70);
});
test('Wszystkie publiczne ścieżki komend odpowiadają poprawnym payloadem',async t=>{
  const db=fixture(t);db.setBalance(G,A,10000);db.buy(G,A,'title_shadow');
  const cases={
    pomoc:{},ping:{},profil:{},ranga:{},portfel:{},top:{},daily:{},praca:{},nagrody:{},poziomy:{},przelew:{osoba:{id:B,bot:false},ilosc:10},historia:{},
    weekly:{},bank:{sub:'saldo'},osiagniecia:{},personalizacja:{sub:'podglad'},ekonomia:{},sklep:{},kup:{przedmiot:'xp_boost'},plecak:{},uzyj:{przedmiot:'title_shadow'},tytul:{sub:'zdejmij'},moneta:{strona:'orzel'},sloty:{stawka:1},
    kostka:{},wrozba:{pytanie:'Test?'},kpn:{wybor:'kamien'},ankieta:{pytanie:'Co gramy?',opcja1:'Roblox',opcja2:'CS2'},pokoj:{},userinfo:{},avatar:{},serverinfo:{},botinfo:{},
  };
  for(const [name,values] of Object.entries(cases)){
    const i=interaction(name,values);assert.equal(await handlePublic(i,db),true,name);assert.ok(i.sent.length,name);
    for(const body of i.sent)for(const card of body.embeds||[])card.toJSON();
  }
});
test('Wszystkie ścieżki moderacji i zarządzania zwracają odpowiedź',async t=>{
  const db=fixture(t);db.user(G,B);
  const base={osoba:{id:B,bot:false},powod:'Powód testowy',ilosc:5,minuty:1,id:B,sekundy:10};
  const cases=['ostrzezenia','warn','unwarn','wyczysc','timeout','untimeout','mute','unmute','kick','ban','unban','slowmode','rola','xp','monety_admin','diagnostyka'];
  for(const name of cases){
    const number=name==='unwarn'?Number(db.addWarning(G,B,A,'test')):1;
    const i=interaction(name,{...base,numer:number});assert.equal(await handleAdmin(i,db),true,name);assert.ok(i.sent.length,name);
    for(const body of i.sent)for(const card of body.embeds||[])card.toJSON();
  }
});


test('Brak uprawnień: publiczna odpowiedź z jedną dozwoloną wzmianką',async t=>{
  const db=fixture(t),i=interaction('ban',{osoba:{id:B},powod:'test'},0);
  await handleAdmin(i,db);assert.equal(i.deferred,false);const body=i.sent[0];
  assert.match(body.content,new RegExp(`<@${A}>`));assert.match(body.content,/nie masz uprawnień/);
  assert.notEqual(body.flags,64);assert.deepEqual(body.allowedMentions,{parse:[],users:[A],repliedUser:false});
  assert.match(body.embeds[0].toJSON().description,/Moderator/);
});
test('Bank przenosi monety bez tworzenia waluty i blokuje wydanie oszczędności',t=>{
  const db=fixture(t);db.setBalance(G,A,1000);
  assert.equal(db.bankMove(G,A,'deposit',750).ok,true);assert.equal(db.user(G,A).balance,250);assert.equal(db.user(G,A).bank,750);
  assert.equal(db.wager(G,A,300,600),false);assert.equal(db.transfer(G,A,B,300),false);
  assert.equal(db.bankMove(G,A,'withdraw',751).ok,false);assert.equal(db.bankMove(G,A,'withdraw',100).ok,true);
  assert.equal(db.user(G,A).balance+db.user(G,A).bank,1000);assert.equal(db.history(G,A)[0].amount,100);
  assert.equal(db.rank(G,A,'wealth'),1);assert.equal(db.top(G,'bank')[0].bank,650);
  assert.throws(()=>db.bankMove(G,A,'deposit',-1),RangeError);
});
test('Nagroda weekly ma niezależny cooldown i nie zmienia serii daily',t=>{
  const db=fixture(t),now=2_000_000_000;
  db.claim(G,A,'daily',config.economy.dailyCooldownMs,350,now);
  assert.equal(db.claim(G,A,'weekly',config.economy.weeklyCooldownMs,1200,now).reward,1200);
  assert.equal(db.claim(G,A,'weekly',config.economy.weeklyCooldownMs,1200,now+config.economy.weeklyCooldownMs-1).ok,false);
  assert.equal(db.user(G,A).daily_streak,1);
});
test('Boosty XP nie nadpisują innej mocy; kontrakt działa tylko na pracę',t=>{
  const db=fixture(t),now=2_000_000_000;db.setBalance(G,A,30000);
  for(const id of ['xp_boost','xp_boost_power','work_boost'])assert.equal(db.buy(G,A,id),true);
  assert.equal(db.use(G,A,'xp_boost',now),true);assert.equal(db.use(G,A,'xp_boost_power',now+1),false);assert.equal(db.owns(G,A,'xp_boost_power'),true);
  assert.equal(db.use(G,A,'xp_boost_power',now+3600001),true);
  const member={roles:{cache:new Set([config.roles.booster])}};
  assert.equal(multiplierFor(member,db.user(G,A),config,now+3600002),4);
  assert.equal(db.use(G,A,'work_boost',now),true);
  assert.equal(db.claim(G,A,'work',config.economy.workCooldownMs,101,now+2).reward,151);
  assert.equal(db.claim(G,A,'daily',config.economy.dailyCooldownMs,350,now+2).reward,350);
  assert.equal(db.claim(G,A,'work',config.economy.workCooldownMs,100,now+10800001).reward,100);
});
test('Motywy i ramki pozostają po restarcie i faktycznie zmieniają PNG',async t=>{
  const db=fixture(t);db.setBalance(G,A,30000);
  for(const id of ['theme_obsidian','frame_crystal']){assert.equal(db.buy(G,A,id),true);assert.equal(db.use(G,A,id),true);assert.equal(db.buy(G,A,id),false);}
  const reopened=new Store(path.dirname(db.db.name));t.after(()=>reopened.close());const row=reopened.user(G,A);
  assert.equal(row.card_theme,'obsidian');assert.equal(row.avatar_frame,'crystal');
  const user={name:'Test'};const styled=await profileCard(user,row,1);reopened.resetAppearance(G,A);
  const basic=await profileCard(user,reopened.user(G,A),1);assert.notDeepEqual(styled,basic);assert.equal(reopened.owns(G,A,'theme_obsidian'),true);
});
test('Osiągnięcia wypłacają nagrodę tylko raz, także po restarcie i zmianie poziomu',t=>{
  const db=fixture(t);db.setXp(G,A,totalXpForLevel(5));
  assert.equal(db.achievementStatus(G,A).find(a=>a.id==='first_steps').ready,true);
  const reward=db.claimAchievements(G,A);assert.equal(reward.reward,250);assert.equal(reward.count,1);
  const reopened=new Store(path.dirname(db.db.name));t.after(()=>reopened.close());assert.equal(reopened.claimAchievements(G,A).reward,0);
  reopened.setXp(G,A,0);reopened.setXp(G,A,totalXpForLevel(5));assert.equal(reopened.claimAchievements(G,A).count,0);
});
test('Zapis najlepszej serii zachowuje osiągnięcie po przerwaniu daily',t=>{
  const db=fixture(t),start=2_000_000_000,cd=config.economy.dailyCooldownMs;
  for(let n=0;n<7;n++)db.claim(G,A,'daily',cd,350,start+n*cd);
  db.claim(G,A,'daily',cd,350,start+10*cd);assert.equal(db.user(G,A).daily_streak,1);
  assert.equal(db.achievementStatus(G,A).find(a=>a.id==='streak').ready,true);
});
test('Dashboard używa zapisanej historii oraz pustych dni, bez generowania przykładowych wyników',t=>{
  const db=fixture(t),now=Date.UTC(2026,8,20,12);
  db.claim(G,A,'work',config.economy.workCooldownMs,100,now-86400000);
  db.claim(G,A,'weekly',config.economy.weeklyCooldownMs,1200,now);
  const stats=db.stats(G,A,now);assert.equal(stats.earned,1300);assert.equal(stats.works,1);assert.equal(stats.days.length,7);
  assert.equal(stats.days.at(-1).income,1200);assert.equal(stats.days.at(-2).income,100);assert.equal(stats.days[0].income,0);
});
test('Każda kategoria sklepu ma canvas, działające dane komponentów i odpowiedni przedmiot',async t=>{
  const db=fixture(t);db.setBalance(G,A,100000);const i=interaction('sklep');
  for(const [category,id] of [['all','xp_boost'],['boosts','work_boost'],['titles','title_void'],['themes','theme_eclipse'],['frames','frame_crown']]){
    const payload=await shopPayload(i,db,id,category,1);assert.equal(payload.files.length,1);assert.equal(payload.components.length,4);
    payload.embeds.forEach(e=>e.toJSON());payload.components.forEach(c=>c.toJSON());
    assert.equal(payload.embeds[0].toJSON().title,`Sklep • ${items[id].name}`);
  }
  const last=await shopPayload(i,db,'frame_crown','all',999);assert.equal(last.components[3].components[1].data.disabled,true);
});
test('Pusty plecak odpowiada kartą bez nieprawidłowego pustego menu',async t=>{
  const db=fixture(t),i=interaction('plecak');await showInventory(i,db);assert.equal(i.sent[0].files.length,1);assert.deepEqual(i.sent[0].components,[]);
});
test('Limit majątku obejmuje bank, a nie tylko portfel',t=>{
  const db=fixture(t);db.setBalance(G,A,1_000_000_000_000);db.bankMove(G,A,'deposit',900_000_000_000);
  assert.throws(()=>db.changeBalance(G,A,1),RangeError);
  assert.throws(()=>db.claim(G,A,'weekly',config.economy.weeklyCooldownMs,1200),RangeError);
  assert.equal(db.user(G,A).last_weekly_at,0);
});


test('Odmowa wynikająca z hierarchii też trafia na czat po prywatnym defer',async t=>{
  const db=fixture(t),i=interaction('warn',{osoba:{id:B,bot:false},powod:'Test'},1);i.member.roles.highest.comparePositionTo=()=>0;
  await handleAdmin(i,db);const denial=i.sent.at(-1);assert.equal(denial.flags,0);assert.match(denial.content,new RegExp(`<@${A}>`));
  assert.equal(db.warnings(G,B).length,0);
});
