import { AttachmentBuilder } from 'discord.js';
import crypto from 'node:crypto';
import { config } from './config.js';
import { rankCard, userForCard } from './cards.js';
import { multiplierFor } from './level.js';

export async function syncLevelRoles(member,level){
  const desired=[...config.levelRoles].reverse().find(role=>level>=role.level)?.id;
  const desiredRole=desired&&member.guild.roles.cache.get(desired);
  if(desired&&!desiredRole){console.warn(`Brak roli poziomowej ${desired}`);return false;}
  if(desiredRole&&!member.roles.cache.has(desired)){
    if(!desiredRole.editable){console.warn(`Rola poziomowa ${desired} jest powyżej bota.`);return false;}
    try{await member.roles.add(desiredRole,'Osiągnięto nowy poziom');}
    catch(e){console.warn('Nadanie roli:',e.message);return false;}
  }
  let ok=true;
  for(const role of config.levelRoles.filter(r=>r.id!==desired&&member.roles.cache.has(r.id))){
    const target=member.guild.roles.cache.get(role.id);
    if(!target?.editable){ok=false;continue;}
    try{await member.roles.remove(role.id,'Wymiana roli poziomowej');}catch(e){ok=false;console.warn('Usunięcie roli:',e.message);}
  }
  return ok;
}
export async function announceLevel(member,result,store){
  if(!result||result.level<=result.oldLevel)return;
  await syncLevelRoles(member,result.level);
  const channel=member.guild.channels.cache.get(config.channels.levelUp)||await member.guild.channels.fetch(config.channels.levelUp).catch(()=>null);
  if(!channel?.send)return;
  const row=store.user(member.guild.id,member.id);
  try{
    const image=await rankCard(userForCard(member),row,store.rank(member.guild.id,member.id));
    await channel.send({content:`🎉 <@${member.id}> wbija **poziom ${result.level}**! Za awans: **${result.bonus} ◈**.`,
      files:[new AttachmentBuilder(image,{name:'level-up.png'})],allowedMentions:{users:[member.id]}});
  }catch(e){console.error('Ogłoszenie awansu:',e);}
}

export async function handleMessageXp(msg,store){
  if(msg.guildId!==config.guildId||!msg.member||msg.author.bot||msg.webhookId||msg.system)return;
  if(config.xp.messageChannels.length&&!config.xp.messageChannels.includes(msg.channelId))return;
  if((msg.content||'').trim().length<3)return;
  const row=store.user(msg.guildId,msg.author.id);
  const base=crypto.randomInt(12,19);
  const amount=Math.round(base*multiplierFor(msg.member,row,config));
  const gained=store.grantMessageXp(msg.guildId,msg.author.id,msg.content,amount,config.xp);
  if(gained?.level>gained?.oldLevel)await announceLevel(msg.member,gained,store);
}

// Settle the PREVIOUS eligibility interval before capturing the new voice state.
// This prevents time in AFK / alone / deafened from leaking into the next minute.
let sessions=new Map();
function capture(client,now){
  const guild=client.guilds.cache.get(config.guildId),next=new Map();
  if(!guild)return next;
  for(const channel of guild.channels.cache.values()){
    if(!channel.isVoiceBased?.())continue;
    const allowed=channel.id!==config.channels.voiceLobby&&channel.id!==guild.afkChannelId&&channel.type!==13&&
      (!config.xp.voiceChannels.length||config.xp.voiceChannels.includes(channel.id));
    const people=[...channel.members.values()].filter(m=>!m.user.bot&&!m.voice.deaf&&!m.voice.selfDeaf);
    const eligible=allowed&&(!config.xp.voiceRequiresTwoPeople||people.length>=2);
    for(const member of channel.members.values()){
      if(member.user.bot)continue;
      next.set(member.id,{member,at:now,eligible:eligible&&people.includes(member),carry:sessions.get(member.id)?.carry||0});
    }
  }
  return next;
}
export async function voiceXpSweep(client,store,now=Date.now()){
  const awards=[];
  for(const session of sessions.values()){
    const ms=Math.max(0,Math.min(75_000,now-session.at));
    const total=session.eligible?ms+session.carry:session.carry;
    const seconds=Math.floor(total/1000);session.carry=total%1000;
    if(!session.eligible||seconds<1)continue;
    const member=session.member,row=store.user(member.guild.id,member.id);
    const amount=Math.round(config.xp.voiceXpPerMinute*multiplierFor(member,row,config,now));
    const gained=store.grantVoiceTime(member.guild.id,member.id,seconds,amount);
    if(gained&&gained.level>gained.oldLevel)awards.push([member,gained]);
  }
  sessions=capture(client,now);
  for(const [member,gained] of awards)await announceLevel(member,gained,store);
}
export function seedVoiceSweep(client,now=Date.now()){sessions=new Map();sessions=capture(client,now);}
