import { AttachmentBuilder, AuditLogEvent, EmbedBuilder } from 'discord.js';
import { config } from './config.js';
import { userForCard, welcomeCard } from './cards.js';

const colors={message:0xE57AAB,voice:0x748EFF,account:0xB2E771,change:0xE9B465};
const auditUse=new Map();
const stamp=date=>`<t:${Math.floor(date/1000)}:F>`;
const clip=(value,max=900)=>String(value||'—').slice(0,max).replace(/```/g,'\`\`\`');
const who=id=>id?`<@${id}>`:'Nieznany';

async function send(guild,kind,title,fields,description='',mention=null,image=null){
  const id=({message:config.channels.messageLog,voice:config.channels.voiceLog,account:config.channels.accountLog,change:config.channels.changeLog})[kind];
  const channel=guild.channels.cache.get(id)||await guild.channels.fetch(id).catch(()=>null);
  if(!channel?.send)return;
  const embed=new EmbedBuilder().setColor(colors[kind]).setTitle(title).setDescription(description||null)
    .addFields(fields.map(([name,value])=>({name,value:clip(value,1000),inline:false}))).setTimestamp();
  if(image)embed.setImage('attachment://welcome.png');
  await channel.send({content:mention?who(mention):undefined,embeds:[embed],
    files:image?[new AttachmentBuilder(image,{name:'welcome.png'})]:[],
    allowedMentions:{parse:[],users:mention?[mention]:[]}}).catch(e=>console.warn('Log:',e.message));
}

export async function logMessageCreate(msg,store){
  if(msg.guildId!==config.guildId||msg.author?.bot)return;
  store.saveMessage(msg);
}
export async function logMessageEdit(oldMsg,newMsg,store){
  if(newMsg.guildId!==config.guildId||newMsg.author?.bot)return;
  const old=store.snapshot(newMsg.id);
  const before=old?.content ?? (!oldMsg.partial?oldMsg.content:'Treść sprzed edycji była poza pamięcią bota');
  if(newMsg.partial) await newMsg.fetch().catch(()=>{});
  if(before===newMsg.content)return;
  if(newMsg.author)store.saveMessage(newMsg);
  await send(newMsg.guild,'message','✎ Zmieniono wiadomość',[
    ['Autor',who(newMsg.author?.id||old?.author_id)],['Kanał',`<#${newMsg.channelId}>`],
    ['Przed',before?clip(before):'(pusta treść)'],['Po',newMsg.content?clip(newMsg.content):'(pusta treść)'],
    ['Link i czas',`[Otwórz wiadomość](${newMsg.url}) • ${stamp(Date.now())}`],
  ]);
}

async function deletionActor(guild,authorId,channelId){
  if(!authorId||!guild.members.me?.permissions.has('ViewAuditLog'))return null;
  await new Promise(resolve=>setTimeout(resolve,900));
  try{
    const entries=await guild.fetchAuditLogs({type:AuditLogEvent.MessageDelete,limit:6});
    for(const entry of entries.entries.values()){
      const age=Date.now()-entry.createdTimestamp;
      if(age<0||age>6000||entry.targetId!==authorId||entry.extra?.channel?.id!==channelId)continue;
      const used=auditUse.get(entry.id)||0;
      const count=Number(entry.extra?.count||1);
      if(used>=count)continue;
      auditUse.set(entry.id,used+1);
      if(auditUse.size>1000)auditUse.clear();
      return entry.executorId;
    }
  }catch(e){console.warn('Odczyt logu audytu usuniętej wiadomości:',e.message);}
  return null;
}
export async function logMessageDelete(msg,store){
  if(msg.guildId!==config.guildId)return;
  const old=store.snapshot(msg.id);store.removeMessage(msg.id);
  if(msg.author?.bot)return;
  const author=old?.author_id||msg.author?.id;
  const actor=await deletionActor(msg.guild,author,msg.channelId);
  await send(msg.guild,'message','⌫ Usunięto wiadomość',[
    ['Autor',who(author)],['Usunął',actor?who(actor):'Nieustalone — brak jednoznacznego wpisu audytu (autor mógł usunąć sam)'],
    ['Kanał i czas',`<#${msg.channelId}> • ${stamp(Date.now())}`],
    ['Treść',old?clip(old.content)||'(brak treści tekstowej)':'Niedostępna: wiadomość nie była w pamięci (snapshoty przechowywane 7 dni)'],
    ...(old?.attachment_names? [['Załączniki',clip(JSON.parse(old.attachment_names).join(', '))]]:[]),
  ]);
}
export async function logBulkDelete(messages,store){
  const any=messages.first();if(any?.guildId!==config.guildId)return;
  for(const m of messages.values())store.removeMessage(m.id);
  await send(any.guild,'message','⌫ Usunięto wiele wiadomości',[
    ['Kanał',`<#${any.channelId}>`],['Liczba',String(messages.size)],['Czas',stamp(Date.now())],
  ],'Operacja zbiorowa. Discord może nie udostępnić treści lub sprawcy każdej wiadomości.');
}

export async function logVoice(oldState,newState){
  if(newState.guild.id!==config.guildId||oldState.channelId===newState.channelId)return;
  const before=oldState.channelId?`<#${oldState.channelId}>`:'poza głosem';
  const after=newState.channelId?`<#${newState.channelId}>`:'poza głosem';
  await send(newState.guild,'voice',!oldState.channelId?'◉ Dołączył do VC':!newState.channelId?'◯ Opuścił VC':'↗ Zmienił kanał VC',[
    ['Osoba',who(newState.id)],['Przejście',`${before}  →  ${after}`],['Czas',stamp(Date.now())],
  ]);
}
export async function logJoin(member){
  const age=Math.max(0,Math.floor((Date.now()-member.user.createdTimestamp)/86400000));
  const image=await welcomeCard(userForCard(member),member.guild.memberCount).catch(()=>null);
  await send(member.guild,'account','✦ Nowa osoba na serwerze',[
    ['Użytkownik',`${who(member.id)} • ${member.user.username} (${member.id})`],
    ['Wiek konta',`${age} dni • utworzone ${stamp(member.user.createdTimestamp)}`],['Dołączenie',stamp(Date.now())],
  ],'',member.id,image);
}
export async function logLeave(member){
  await send(member.guild,'account','◯ Osoba opuściła serwer',[
    ['Osoba',`${who(member.id)} • ${member.user.username}`],['Wiek konta',`${Math.floor((Date.now()-member.user.createdTimestamp)/86400000)} dni`],
    ['Czas',stamp(Date.now())],
  ],'Wyrzucenia i bany pojawiają się w logu zmian, jeśli Discord udostępni wpis audytu.',member.id);
}
export async function logMemberUpdate(oldMember,newMember){
  const fields=[];
  if(oldMember.nickname!==newMember.nickname)fields.push(['Nick serwerowy',`${clip(oldMember.nickname||'(brak)',150)} → ${clip(newMember.nickname||'(brak)',150)}`]);
  if(oldMember.communicationDisabledUntilTimestamp!==newMember.communicationDisabledUntilTimestamp){
    const time=newMember.communicationDisabledUntilTimestamp;
    fields.push(['Przerwa / timeout',time?`Do ${stamp(time)}`:'Zakończono']);
  }
  const added=newMember.roles.cache.filter(r=>!oldMember.roles.cache.has(r.id)&&r.id!==newMember.guild.id).map(r=>`<@&${r.id}>`);
  const removed=oldMember.roles.cache.filter(r=>!newMember.roles.cache.has(r.id)&&r.id!==newMember.guild.id).map(r=>`<@&${r.id}>`);
  if(added.length)fields.push(['Nadano role',added.slice(0,10).join(', ')]);
  if(removed.length)fields.push(['Usunięto role',removed.slice(0,10).join(', ')]);
  if(fields.length)await send(newMember.guild,'change','⚙ Zmiana dotycząca osoby',[['Osoba',who(newMember.id)],...fields,['Czas',stamp(Date.now())]],'Kto wykonał zmianę: sprawdź powiązany wpis audytu.');
  if(oldMember.avatar!==newMember.avatar)await send(newMember.guild,'account','✦ Zmieniono zdjęcie serwerowe',[['Osoba',who(newMember.id)],['Czas',stamp(Date.now())]]);
}
export async function logUserUpdate(oldUser,newUser,client){
  if(oldUser.username===newUser.username&&oldUser.globalName===newUser.globalName&&oldUser.avatar===newUser.avatar)return;
  for(const guild of client.guilds.cache.values()){
    if(guild.id!==config.guildId||!guild.members.cache.has(newUser.id))continue;
    const fields=[['Osoba',who(newUser.id)]];
    if(oldUser.username!==newUser.username)fields.push(['Login',`${clip(oldUser.username,100)} → ${clip(newUser.username,100)}`]);
    if(oldUser.globalName!==newUser.globalName)fields.push(['Globalna nazwa',`${clip(oldUser.globalName||'—',100)} → ${clip(newUser.globalName||'—',100)}`]);
    if(oldUser.avatar!==newUser.avatar)fields.push(['Awatar','Zmieniono zdjęcie profilowe']);
    fields.push(['Czas',stamp(Date.now())]);
    await send(guild,'account','✦ Zmiana profilu Discord',fields);
  }
}

const auditNames=new Map([
  [AuditLogEvent.GuildUpdate,'Zmiana serwera'],
  [AuditLogEvent.ChannelCreate,'Utworzenie kanału'],[AuditLogEvent.ChannelUpdate,'Zmiana kanału'],[AuditLogEvent.ChannelDelete,'Usunięcie kanału'],
  [AuditLogEvent.ChannelOverwriteCreate,'Nowe uprawnienia kanału'],[AuditLogEvent.ChannelOverwriteUpdate,'Zmiana uprawnień kanału'],[AuditLogEvent.ChannelOverwriteDelete,'Usunięcie uprawnień kanału'],
  [AuditLogEvent.MemberKick,'Wyrzucenie'],[AuditLogEvent.MemberBanAdd,'Ban'],[AuditLogEvent.MemberBanRemove,'Zdjęcie bana'],
  [AuditLogEvent.MemberUpdate,'Zmiana użytkownika / timeout'],[AuditLogEvent.MemberRoleUpdate,'Zmiana ról użytkownika'],
  [AuditLogEvent.RoleCreate,'Utworzenie roli'],[AuditLogEvent.RoleUpdate,'Zmiana roli'],[AuditLogEvent.RoleDelete,'Usunięcie roli'],
  [AuditLogEvent.MemberMove,'Przeniesienie głosowe'],[AuditLogEvent.MemberDisconnect,'Odłączenie głosowe'],
  [AuditLogEvent.InviteCreate,'Nowe zaproszenie'],[AuditLogEvent.InviteDelete,'Usunięcie zaproszenia'],
]);
export async function logAudit(entry,guild){
  const title=auditNames.get(entry.action);
  if(!title||guild.id!==config.guildId)return;
  const safeJSON=v=>JSON.stringify(v??'—',(_,x)=>typeof x==='bigint'?String(x):x);
  const changes=(entry.changes||[]).slice(0,5).map(c=>{
    if(c.key==='$add'||c.key==='$remove')return `${c.key==='$add'?'Nadano':'Usunięto'}: ${(c.new||[]).map(r=>`<@&${r.id}>`).join(' ')}`;
    return `${c.key}: ${clip(safeJSON(c.old),70)} → ${clip(safeJSON(c.new),70)}`;
  }).join('\n');
  await send(guild,'change',`⚙ ${title}`,[
    ['Wykonał',who(entry.executorId)],['Dotyczy',entry.targetId?String(entry.targetId):'Serwer'],
    ...(entry.reason?[['Powód',entry.reason]]:[]),...(changes?[['Szczegóły',changes]]:[]),
    ['Czas',stamp(entry.createdTimestamp)],
  ]);
}

export async function logStaffAction(guild,action,actorId,targetId,details){
  await send(guild,'change',`⚙ ${action}`,[['Wykonał',who(actorId)],
    ...(targetId?[['Dotyczy',who(targetId)]]:[]),['Szczegóły',details],['Czas',stamp(Date.now())]]);
}
