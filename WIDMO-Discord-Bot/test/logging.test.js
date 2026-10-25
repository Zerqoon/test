import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { AuditLogEvent, Collection, Events } from 'discord.js';
process.env.DATABASE_PATH=':memory:';
process.env.GUILD_ID='111111111111111111';
const {config}=await import('../src/config.js');
const {db}=await import('../src/db.js');
const {installLogging,logEvent}=await import('../src/logging.js');
const client=new EventEmitter();
const sent=[];
client.channels={fetch:async()=>({guildId:config.guildId,isTextBased:()=>true,send:async p=>{sent.push(p);return p;}})};
const logger=installLogging(client);
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const message=(id,content,extra={})=>({id,guildId:config.guildId,channelId:'222222222222222222',author:{id:'333333333333333333',tag:'Tester',bot:false},content,attachments:new Collection(),embeds:[],stickers:new Collection(),partial:false,...extra});
after(()=>{logger.stop();db.close();});
test('skasowana wiadomość ma autora, pełną treść i link do kanału, nawet bez cache Discord',async()=>{
  sent.length=0;
  client.emit(Events.MessageCreate,message('444444444444444444','Bardzo ważny tekst'));
  await flush();
  client.emit(Events.MessageDelete,message('444444444444444444',undefined,{partial:true,author:null}));
  await flush();
  assert.equal(sent.length,1);
  assert.match(JSON.stringify(sent[0].embeds[0].data),/333333333333333333/);
  assert.match(sent[0].files[0].attachment.toString(),/Bardzo ważny tekst/);
  assert.equal(sent[0].components[0].components[0].data.url,`https://discord.com/channels/${config.guildId}/222222222222222222`);
});
test('edycja zapisuje poprzednią i nową treść, przycisk prowadzi do wiadomości',async()=>{
  sent.length=0;
  const a=message('555555555555555555','Pierwsza treść'),b=message(a.id,'Zmieniona treść');
  client.emit(Events.MessageCreate,a);await flush();client.emit(Events.MessageUpdate,a,b);await flush();
  assert.equal(sent.length,1);
  const text=sent[0].files[0].attachment.toString();assert.match(text,/Pierwsza treść/);assert.match(text,/Zmieniona treść/);
  assert.ok(sent[0].components[0].components[0].data.url.endsWith(a.id));
});
test('GIF jest logowany; wiadomości bota i kanału logów nie tworzą pętli',async()=>{
  sent.length=0;
  client.emit(Events.MessageCreate,message('666666666666666666','https://tenor.com/view/example'));
  client.emit(Events.MessageCreate,message('777777777777777777','https://tenor.com/view/example',{author:{bot:true}}));
  client.emit(Events.MessageCreate,message('888888888888888888','https://tenor.com/view/example',{channelId:config.channels.messages}));
  await flush();assert.equal(sent.length,1);assert.match(sent[0].embeds[0].data.title,/GIF/);
});

test('audyt roli pokazuje polski opis, wykonawcę i rolę zamiast JSON',async()=>{
  sent.length=0;
  client.emit(Events.GuildAuditLogEntryCreate,{
    action:AuditLogEvent.MemberRoleUpdate,id:'999999999999999999',
    executorId:'333333333333333333',executor:{tag:'Moderator'},
    targetId:'444444444444444444',target:{tag:'Gracz'},targetType:'User',reason:'Awans',
    changes:[{key:'$add',new:[{id:'555555555555555555',name:'Weteran'}]}],
  },{id:config.guildId});
  await flush();
  assert.equal(sent.length,1);
  const e=sent[0].embeds[0].toJSON();
  const text=[e.title,...e.fields.map(f=>`${f.name}\n${f.value}`)].join('\n');
  assert.match(text,/Weteran/);assert.match(text,/Moderator/);assert.match(text,/333333333333333333/);
  assert.match(text,/555555555555555555/);assert.match(text,/Awans/);
  assert.doesNotMatch(text,/[{}]|\[object Object\]|MemberRoleUpdate|\$add|"key"|"new"/);
  assert.deepEqual(sent[0].allowedMentions.parse,[]);
});

test('długie logi mieszczą się w limitach i zachowują pełny zapis w TXT',async()=>{
  sent.length=0;
  const fields=Array.from({length:35},(_,n)=>({name:`Zmiana ${n}`,value:`${n}: ${'👻'.repeat(1500)} koniec ${n}`}));
  await logEvent(client,config.channels.moderation,{title:'Audyt',description:'Opis'.repeat(1600),fields});
  const e=sent[0].embeds[0].toJSON();
  assert.ok(e.fields.length<=25);assert.ok(e.description.length<=4096);
  let size=e.title.length+e.description.length+e.footer.text.length;
  for(const f of e.fields){assert.ok(f.name.length<=256);assert.ok(f.value.length<=1024);assert.ok(f.value.isWellFormed());size+=f.name.length+f.value.length;}
  assert.ok(size<=6000,`embed length ${size}`);
  const file=sent[0].files.find(f=>f.name==='szczegoly-logu.txt').attachment.toString();
  assert.ok(file.includes(fields[34].value));assert.ok(file.includes('Opis'.repeat(1600)));
});

test('krótki log nie dodaje zbędnego pliku, tekst użytkownika zachowuje nawiasy',async()=>{
  sent.length=0;
  await logEvent(client,config.channels.moderation,{title:'Test',fields:[{name:'Treść',value:'Przykład {gracz} [tekst]'}]});
  assert.equal(sent[0].files.length,0);
  assert.equal(sent[0].embeds[0].data.fields[0].value,'Przykład {gracz} [tekst]');
});

test('szybkie edycje A-B-C nie gubią wersji przy opóźnionej wysyłce',async()=>{
  sent.length=0;
  const normalFetch=client.channels.fetch;
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  let first=true;
  client.channels.fetch=async()=>({guildId:config.guildId,isTextBased:()=>true,send:async p=>{
    if(first){first=false;await gate;}sent.push(p);return p;
  }});
  try {
    const m=message('111111111111111112','A');
    client.emit(Events.MessageCreate,m);
    let before={...m};m.content='B';client.emit(Events.MessageUpdate,before,m);
    await flush();
    before={...m};m.content='C';client.emit(Events.MessageUpdate,before,m);
    before={...m};m.content='D';client.emit(Events.MessageUpdate,before,m);
    release();for(let n=0;n<4;n++)await flush();
    assert.equal(sent.length,3);
    assert.deepEqual(sent.map(p=>p.embeds[0].data.fields.find(f=>f.name==='Po').value),['B','C','D']);
    assert.deepEqual(sent.map(p=>p.embeds[0].data.fields.find(f=>f.name==='Przed').value),['A','B','C']);
  } finally {release();client.channels.fetch=normalFetch;}
});

test('bulk delete czeka na edycję i nie odtwarza usuniętego snapshotu',async()=>{
  sent.length=0;
  const id='111111111111111113';
  const before=message(id,'Przed');
  client.emit(Events.MessageCreate,before);
  let release;
  const partial=message(id,undefined,{partial:true,fetch:()=>new Promise(resolve=>{release=()=>resolve(message(id,'Po edycji'));})});
  client.emit(Events.MessageUpdate,before,partial);await flush();
  client.emit(Events.MessageBulkDelete,new Collection([[id,message(id,undefined,{partial:true,author:null})]]));
  await flush();assert.equal(sent.length,0);
  release();for(let n=0;n<4;n++)await flush();
  assert.equal(sent.length,2);
  assert.match(sent[1].embeds[0].data.title,/Zbiorcze/);
  assert.match(sent[1].files[0].attachment.toString(),/Po edycji/);
  assert.equal(db.prepare('SELECT id FROM message_snapshots WHERE id=?').get(id),undefined);
});

test('usunięte media widać przed edycją, a samo ładowanie podglądu linku nie jest edycją',async()=>{
  sent.length=0;
  const a=message('111111111111111114','Zdjęcie',{attachments:new Collection([['a',{name:'foto.png',url:'https://example.com/foto.png',contentType:'image/png'}]])});
  client.emit(Events.MessageCreate,a);
  const b=message(a.id,'Zdjęcie');
  client.emit(Events.MessageUpdate,a,b);await flush();
  const fields=sent[0].embeds[0].data.fields;
  assert.match(fields.find(f=>f.name==='Media przed edycją').value,/foto\.png/);
  assert.equal(fields.find(f=>f.name==='Media po edycji').value,'Brak');
  const c={...b,embeds:[{url:'https://example.com',title:'Podgląd'}]};
  client.emit(Events.MessageUpdate,b,c);await flush();
  assert.equal(sent.length,1);
});

test('wyjście częściowego członka nie pokazuje undefined i audyt innego serwera jest pomijany',async()=>{
  sent.length=0;
  client.emit(Events.GuildMemberRemove,{id:'333333333333333333',guild:{id:config.guildId},user:null});
  client.emit(Events.GuildAuditLogEntryCreate,{action:AuditLogEvent.RoleCreate},{id:'777777777777777777'});
  await flush();
  assert.equal(sent.length,1);
  assert.doesNotMatch(JSON.stringify(sent[0].embeds[0].toJSON()),/undefined|null|NaN/);
});
