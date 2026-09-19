import { AttachmentBuilder } from 'discord.js';
import crypto from 'node:crypto';
import { config } from './config.js';
import { rankCard, userForCard } from './cards.js';
import { multiplierFor } from './level.js';

export async function syncLevelRoles(member,level){
  const desired=[...config.levelRoles].reverse().find(role=>level>=role.level)?.id;
  const toRemove=config.levelRoles.filter(role=>role.id!==desired&&member.roles.cache.has(role.id));
  const desiredRole=desired&&member.guild.roles.cache.get(desired);
  if(desiredRole&&!member.roles.cache.has(desired)){
    if(desiredRole.editable) await member.roles.add(desiredRole,'Osiągnięto nowy poziom').catch(e=>console.warn('Nadanie roli:',e.message));
    else console.warn(`Nie mogę nadać roli poziomowej ${desired}. Ustaw rolę bota wyżej.`);
  }
  for(const role of toRemove){
    const target=member.guild.roles.cache.get(role.id);
    if(target?.editable)await member.roles.remove(role.id,'Wymiana roli poziomowej').catch(e=>console.warn('Usunięcie starej roli:',e.message));
  }
}
export async function announceLevel(member,result,store){
  if(!result||result.level<=result.oldLevel)return;
  await syncLevelRoles(member,result.level);
  const channel=member.guild.channels.cache.get(config.channels.levelUp);
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

const lastSweep=new Map();
export async function voiceXpSweep(client,store){
  const guild=client.guilds.cache.get(config.guildId);if(!guild)return;
  const now=Date.now();
  for(const channel of guild.channels.cache.values()){
    if(!channel.isVoiceBased?.()||channel.id===config.channels.voiceLobby||channel.id===guild.afkChannelId||channel.type===13)continue;
    if(config.xp.voiceChannels.length&&!config.xp.voiceChannels.includes(channel.id))continue;
    const people=[...channel.members.values()].filter(m=>!m.user.bot&&!m.voice.deaf&&!m.voice.selfDeaf);
    if(config.xp.voiceRequiresTwoPeople&&people.length<2){
      for(const member of channel.members.values())lastSweep.set(`${guild.id}:${member.id}`,now);
      continue;
    }
    for(const member of channel.members.values()){
      if(!people.some(active=>active.id===member.id))lastSweep.set(`${guild.id}:${member.id}`,now);
    }
    for(const member of people){
      const key=`${guild.id}:${member.id}`;
      const since=lastSweep.get(key)??now;
      const seconds=Math.min(75,Math.max(0,Math.floor((now-since)/1000)));
      lastSweep.set(key,now);
      if(seconds<1)continue;
      const row=store.user(guild.id,member.id);
      const amount=Math.round(config.xp.voiceXpPerMinute*multiplierFor(member,row,config));
      const gained=store.grantVoiceTime(guild.id,member.id,seconds,amount);
      if(gained?.level>gained.oldLevel)await announceLevel(member,gained,store);
    }
  }
  // Someone who left voice no longer earns time; forget the sweep timestamp.
  for(const key of lastSweep.keys()){
    const userId=key.split(':')[1];
    if(!guild.members.cache.get(userId)?.voice.channelId)lastSweep.delete(key);
  }
}
export function seedVoiceSweep(client){
  const guild=client.guilds.cache.get(config.guildId);
  if(!guild)return;
  for(const channel of guild.channels.cache.values()){
    if(channel.isVoiceBased?.())for(const member of channel.members.values())lastSweep.set(`${guild.id}:${member.id}`,Date.now());
  }
}
