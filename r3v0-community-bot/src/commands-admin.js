import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { config } from './config.js';
import { announceLevel, syncLevelRoles } from './experience.js';
import { logStaffAction } from './logs.js';
import { diagnose } from './diagnostics.js';

const reply=(i,content)=>i.deferred?i.editReply({content,allowedMentions:{parse:[]}}):
  i.reply({content,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
const tier=i=>i.user.id===i.guild.ownerId||i.member.roles.cache.has(config.roles.chief)?3:
  i.member.roles.cache.has(config.roles.moderator)?2:i.member.roles.cache.has(config.roles.helper)?1:0;
async function member(i){return i.guild.members.fetch(i.options.getUser('osoba',true).id).catch(()=>null);}
function canAct(i,target){
  if(!target||target.id===i.guild.ownerId||target.id===i.user.id||target.user.bot)return false;
  if(i.user.id!==i.guild.ownerId&&i.member.roles.highest.comparePositionTo(target.roles.highest)<=0)return false;
  const bot=i.guild.members.me;
  return !!bot&&bot.roles.highest.comparePositionTo(target.roles.highest)>0;
}
function reason(i){return `${i.options.getString('powod',true)} | Moderator: ${i.user.username} (${i.user.id})`;}

export async function handleAdmin(i,store){
  const name=({mute:'timeout',unmute:'untimeout'})[i.commandName]||i.commandName,guild=i.guildId;
  const staff=['warn','unwarn','wyczysc','timeout','untimeout','kick','ban','unban','slowmode','zamknij','otworz','rola','xp','monety_admin','diagnostyka'];
  if(!staff.includes(name)&&name!=='ostrzezenia')return false;
  const level=tier(i),required=['rola','xp','monety_admin','diagnostyka'].includes(name)?3:
    ['timeout','untimeout','kick','ban','unban','slowmode','zamknij','otworz'].includes(name)?2:1;
  if(name==='ostrzezenia'){
    const target=i.options.getUser('osoba')||i.user;
    if(target.id!==i.user.id&&level<1){await reply(i,'Cudze ostrzeżenia widzi tylko ekipa.');return true;}
    const warnings=store.warnings(guild,target.id);
    await reply(i,warnings.length?`⚠ Ostrzeżenia <@${target.id}>:\n${warnings.map(w=>`#${w.id} • <t:${Math.floor(w.created_at/1000)}:d> • ${w.reason.slice(0,120)} (od <@${w.moderator_id}>)`).join('\n')}`:'Brak ostrzeżeń.');return true;
  }
  if(level<required){await reply(i,`Nie masz roli wymaganej do tej komendy (${required===3?'Szef':required===2?'Namiestnik lub Szef':'Strażnik, Namiestnik lub Szef'}).`);return true;}
  await i.deferReply({flags:MessageFlags.Ephemeral});
  if(name==='diagnostyka'){
    const lines=await diagnose(i.guild);
    await i.editReply(`**Stan konfiguracji:**\n${lines.join('\n').slice(0,1900)}`);return true;
  }

  if(name==='warn'){
    const target=await member(i);
    if(!canAct(i,target)){await reply(i,'Nie można ostrzec tej osoby (hierarchia ról lub brak członkostwa).');return true;}
    const id=store.addWarning(guild,target.id,i.user.id,i.options.getString('powod',true));
    await logStaffAction(i.guild,'Ostrzeżenie',i.user.id,target.id,`#${id}: ${i.options.getString('powod',true)}`);
    await reply(i,`⚠ Ostrzeżenie #${id} dla <@${target.id}> zapisane.`);return true;
  }
  if(name==='unwarn'){
    const id=i.options.getInteger('numer',true),found=store.removeWarning(guild,id);
    if(found)await logStaffAction(i.guild,'Usunięto ostrzeżenie',i.user.id,null,`#${id}`);
    await reply(i,found?`Usunięto ostrzeżenie #${id}.`:'Nie znaleziono ostrzeżenia o tym numerze.');return true;
  }
  if(name==='wyczysc'){
    if(!i.channel?.bulkDelete){await reply(i,'Ta komenda działa na kanałach tekstowych.');return true;}
    const count=i.options.getInteger('ilosc',true);
    const deleted=await i.channel.bulkDelete(count,true);
    await logStaffAction(i.guild,'Czyszczenie wiadomości',i.user.id,null,`<#${i.channelId}> • ${deleted.size} wiadomości`);
    await reply(i,`Usunięto **${deleted.size}** wiadomości. Wiadomości starszych niż 14 dni Discord nie usunął.`);return true;
  }
  if(['timeout','untimeout','kick','ban'].includes(name)){
    const target=await member(i);
    if(!canAct(i,target)){await reply(i,'Nie można wykonać działania na tej osobie: sprawdź członkostwo i hierarchię ról użytkownika oraz bota.');return true;}
    if(name==='timeout'){
      const minutes=i.options.getInteger('minuty',true);await target.timeout(minutes*60000,reason(i));
      await reply(i,`⏳ Przerwa dla <@${target.id}>: **${minutes} min**.`);
    }else if(name==='untimeout'){await target.timeout(null,reason(i));await reply(i,`Zakończono przerwę dla <@${target.id}>.`);}
    else if(name==='kick'){await target.kick(reason(i));await reply(i,`Wyrzucono <@${target.id}>.`);}
    else{await target.ban({reason:reason(i),deleteMessageSeconds:0});await reply(i,`Zbanowano <@${target.id}>.`);}
    return true;
  }
  if(name==='unban'){
    const id=i.options.getString('id',true);
    if(!/^\d{17,21}$/.test(id)){await reply(i,'Podaj prawidłowe ID użytkownika.');return true;}
    await i.guild.bans.remove(id,reason(i));await reply(i,`Zdjęto bana z użytkownika ${id}.`);return true;
  }
  if(['slowmode','zamknij','otworz'].includes(name)){
    const channel=i.channel;
    if(!channel?.permissionOverwrites||!channel?.isTextBased()){await reply(i,'Komenda działa na zwykłym kanale tekstowym serwera.');return true;}
    if(name==='slowmode'){
      if(!channel.setRateLimitPerUser){await reply(i,'Na tym kanale nie da się ustawić slowmode.');return true;}
      await channel.setRateLimitPerUser(i.options.getInteger('sekundy',true),`Zmiana przez ${i.user.username}`);
      await reply(i,`Slowmode: **${i.options.getInteger('sekundy',true)} s**.`);
    }else{
      await channel.permissionOverwrites.edit(i.guild.id,{SendMessages:name==='zamknij'?false:null},{reason:`Zmiana przez ${i.user.username}`});
      await reply(i,name==='zamknij'?'Kanał zamknięty dla @everyone.':'Przywrócono odziedziczone prawo pisania.');
    }
    return true;
  }
  if(name==='rola'){
    const target=await member(i),role=i.options.getRole('rola',true),action=i.options.getSubcommand();
    if(!canAct(i,target)||role.id===i.guild.id||role.managed||!role.editable||
      (i.user.id!==i.guild.ownerId&&role.position>=i.member.roles.highest.position)){
      await reply(i,'Nie można zmienić tej roli lub osoby. Sprawdź hierarchię ról.');return true;
    }
    if(action==='nadaj')await target.roles.add(role,`Nadano przez ${i.user.username}`);
    else await target.roles.remove(role,`Zdjęto przez ${i.user.username}`);
    await reply(i,`${action==='nadaj'?'Nadano':'Zdjęto'} ${role} ${target}.`);return true;
  }
  if(name==='xp'||name==='monety_admin'){
    const target=await member(i),action=i.options.getSubcommand(),value=i.options.getInteger('ilosc',true);
    if(!target||target.user.bot){await reply(i,'Wybierz osobę z serwera, która nie jest botem.');return true;}
    if(name==='xp'){
      const result=action==='ustaw'?store.setXp(guild,target.id,value):store.changeXp(guild, target.id,action==='dodaj'?value:-value);
      await syncLevelRoles(target,result.level);
      if(result.level>result.oldLevel)await announceLevel(target,result,store);
      await logStaffAction(i.guild,'Korekta XP',i.user.id,target.id,`${action} ${value}; teraz ${result.xp} XP`);
      await reply(i,`XP osoby <@${target.id}>: **${result.xp}**, poziom **${result.level}**.`);
    }else{
      const balance=action==='ustaw'?store.setBalance(guild,target.id,value):store.changeBalance(guild,target.id,action==='dodaj'?value:-value);
      await logStaffAction(i.guild,'Korekta monet',i.user.id,target.id,`${action} ${value}; teraz ${balance} ◈`);
      await reply(i,`Saldo osoby <@${target.id}>: **${balance} ◈**.`);
    }
    return true;
  }
  return false;
}
