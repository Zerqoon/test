import { ChannelType, MessageFlags, PermissionFlagsBits as P } from 'discord.js';
import { syncLevelRoles } from './experience.js';
import { logStaffAction } from './logs.js';
import { diagnose } from './diagnostics.js';
import { config } from './config.js';
import { commandStatus, cleanAndSyncCommands, syncGuildCommands } from './command-manager.js';
import { canModerate, actorCanTarget, staffTier, tierName } from './permissions.js';
import { embed, fmt, notice, respond, safe, stamp, denyPermission } from './ui.js';

const staff=new Set(['warn','unwarn','wyczysc','timeout','untimeout','kick','ban','unban','slowmode','zamknij','otworz','rola','xp','monety_admin','diagnostyka','komendy']);
const requiredPermissions={
  wyczysc:[[P.ManageMessages,'Zarządzanie wiadomościami'],[P.ReadMessageHistory,'Czytanie historii']],
  timeout:[[P.ModerateMembers,'Moderowanie członków']],untimeout:[[P.ModerateMembers,'Moderowanie członków']],
  kick:[[P.KickMembers,'Wyrzucanie członków']],ban:[[P.BanMembers,'Banowanie członków']],unban:[[P.BanMembers,'Banowanie członków']],
  slowmode:[[P.ManageChannels,'Zarządzanie kanałami']],zamknij:[[P.ManageRoles,'Zarządzanie uprawnieniami']],otworz:[[P.ManageRoles,'Zarządzanie uprawnieniami']],
  rola:[[P.ManageRoles,'Zarządzanie rolami']],xp:[[P.ManageRoles,'Zarządzanie rolami']],
};
const targetMember=i=>i.guild.members.fetch(i.options.getUser('osoba',true).id).catch(()=>null);
const reason=i=>`${i.options.getString('powod',true)} | ${i.user.username} (${i.user.id})`.slice(0,512);
const done=(i,title,description)=>notice(i,title,description,true);
const fail=(i,description)=>notice(i,'Nie można wykonać operacji',description,true,true);
async function checkActor(i,target){
  if(!target){await fail(i,'Nie znaleziono wskazanej osoby na serwerze.');return false;}
  if(!actorCanTarget(i,target)){await denyPermission(i,'Rola wyższa niż rola wskazanej osoby','Nie możesz zarządzać sobą, właścicielem serwera, botami ani osobą równą lub wyższą w hierarchii.');return false;}
  return true;
}

export async function handleAdmin(i,store,commandPayload=[]){
  const name=({mute:'timeout',unmute:'untimeout'})[i.commandName]||i.commandName,guild=i.guildId;
  if(!staff.has(name)&&name!=='ostrzezenia')return false;
  const tier=staffTier(i),required=['rola','xp','monety_admin','diagnostyka','komendy'].includes(name)?3:
    ['timeout','untimeout','kick','ban','unban','slowmode','zamknij','otworz'].includes(name)?2:1;
  if(name==='ostrzezenia'){
    const target=i.options.getUser('osoba')||i.user;
    if(target.id!==i.user.id&&tier<1){await denyPermission(i,'Helper (Strażnik) lub wyższy','Możesz przeglądać własne ostrzeżenia.');return true;}
    const warnings=store.warnings(guild,target.id);
    await respond(i,{embeds:[embed('Ostrzeżenia użytkownika',`Osoba: <@${target.id}>\n${warnings.length?'Maksymalnie 15 ostatnich wpisów.':'Brak zapisanych ostrzeżeń.'}`)
      .addFields(...warnings.map(w=>({name:`Sprawa #${w.id}`,value:`${safe(w.reason.slice(0,160))}\nModerator: <@${w.moderator_id}> • ${stamp(w.created_at,'d')}`})))]},true);return true;
  }
  if(tier<required){await denyPermission(i,`${tierName(required)} lub wyższy`,`Twój dostęp: **${tierName(tier)}**.`);return true;}
  await i.deferReply({flags:MessageFlags.Ephemeral});
  const permissions=['wyczysc','slowmode','zamknij','otworz'].includes(name)?i.appPermissions:i.guild.members.me?.permissions;
  const missing=(requiredPermissions[name]||[]).filter(([flag])=>!permissions?.has(flag));
  if(missing.length){await fail(i,`Bot nie ma uprawnień: **${missing.map(([,label])=>label).join(', ')}**. Popraw rolę bota lub nadpisania tego kanału.`);return true;}
  if(name==='komendy'){
    const action=i.options.getSubcommand(),clientId=config.clientId||i.client.user.id;
    if(!clientId||!commandPayload.length){await fail(i,'Brakuje CLIENT_ID albo lokalnego zestawu komend. Uzupełnij .env i uruchom ponownie bota.');return true;}
    if(action==='status'){
      const status=await commandStatus(clientId,commandPayload,guild);
      const stale=status.staleGuild.length?status.staleGuild.map(n=>`/${n}`).join(', '):'brak';
      const missing=status.missingGuild.length?status.missingGuild.map(n=>`/${n}`).join(', '):'brak';
      await respond(i,{embeds:[embed('Stan slash commandów','Porównanie bieżącego projektu z komendami zapisanymi po stronie Discorda.')
        .addFields({name:'Projekt / serwer / globalne',value:`**${status.desired} / ${status.guild} / ${status.global}**`},
          {name:'Stare na serwerze',value:safe(stale).slice(0,1024)},
          {name:'Brakujące na serwerze',value:safe(missing).slice(0,1024)},
          {name:'Globalne komendy',value:status.global?`Wykryto **${status.global}**. Jeśli są to stare wpisy, użyj \`/komendy wyczysc_stare\`.`:'Brak — prawidłowo dla tego projektu.'})]});
      return true;
    }
    if(action==='synchronizuj'){
      const result=await syncGuildCommands(clientId,commandPayload,guild);
      await done(i,'Komendy zsynchronizowane',`Discord otrzymał aktualny zestaw **${result.count}** komend serwerowych. Stare komendy serwerowe spoza projektu zostały usunięte.`);
      return true;
    }
    if(action==='wyczysc_stare'){
      const result=await cleanAndSyncCommands(clientId,commandPayload,guild);
      await done(i,'Stare komendy wyczyszczone',`Usunięto **${result.global.removed}** komend globalnych i zapisano **${result.guild.count}** aktualnych komend serwerowych. Zniknięcie starych wpisów z klienta Discord może wymagać odświeżenia aplikacji.`);
      return true;
    }
  }
  if(name==='diagnostyka'){
    const lines=await diagnose(i.guild),groups=[];
    for(let start=0;start<lines.length;start+=15)groups.push(embed(`Diagnostyka • część ${groups.length+1}`,lines.slice(start,start+15).join('\n')));
    await respond(i,{embeds:groups});return true;
  }
  if(name==='warn'){
    const target=await targetMember(i),why=i.options.getString('powod',true).trim();
    if(!why){await fail(i,'Powód ostrzeżenia nie może być pusty.');return true;}
    if(!await checkActor(i,target))return true;
    if(!canModerate(i,target)){await fail(i,'Wybierz inną osobę z serwera, poniżej Twojej roli oraz roli bota. Nie można ostrzec właściciela ani bota.');return true;}
    const id=store.addWarning(guild,target.id,i.user.id,why);
    await done(i,`Zapisano ostrzeżenie #${id}`,`Osoba: <@${target.id}>\nPowód: **${safe(why)}**\nLista wpisów: \`/ostrzezenia osoba:@osoba\`.`);
    await logStaffAction(i.guild,'Ostrzeżenie',i.user.id,target.id,`#${id}: ${why}`);return true;
  }
  if(name==='unwarn'){
    const id=i.options.getInteger('numer',true),warning=store.warning(guild,id);
    if(!warning){await fail(i,`Nie znaleziono ostrzeżenia **#${id}** na tym serwerze.`);return true;}
    const target=await i.guild.members.fetch(warning.user_id).catch(()=>null);
    if(target&&!await checkActor(i,target))return true;
    if(target&&!canModerate(i,target)){await fail(i,'Rola bota musi znajdować się wyżej niż rola wskazanej osoby.');return true;}
    store.removeWarning(guild,id);
    await done(i,'Ostrzeżenie usunięte',`Usunięto sprawę **#${id}** osoby <@${warning.user_id}>.`);
    await logStaffAction(i.guild,'Usunięto ostrzeżenie',i.user.id,warning.user_id,`#${id}: ${warning.reason}`);return true;
  }
  if(name==='wyczysc'){
    if(!i.channel?.bulkDelete){await fail(i,'Ta komenda wymaga kanału obsługującego zbiorowe usuwanie wiadomości.');return true;}
    const count=i.options.getInteger('ilosc',true),deleted=await i.channel.bulkDelete(count,true);
    await done(i,'Kanał posprzątany',`Usunięto **${deleted.size} z ${count}** żądanych wiadomości w <#${i.channelId}>.\nWiadomości starsze niż 14 dni są pomijane.`);
    await logStaffAction(i.guild,'Czyszczenie wiadomości',i.user.id,null,`<#${i.channelId}> • ${deleted.size} wiadomości`);return true;
  }
  if(['timeout','untimeout','kick','ban'].includes(name)){
    const target=await targetMember(i),why=i.options.getString('powod',true).trim();
    if(!why){await fail(i,'Podaj niepusty powód działania.');return true;}
    if(!await checkActor(i,target))return true;
    if(!canModerate(i,target)){await fail(i,'Sprawdź członkostwo oraz hierarchię. Osoba musi być poniżej Ciebie i bota; nie może być właścicielem, Tobą ani botem.');return true;}
    if(['timeout','untimeout'].includes(name)&&!target.moderatable){await fail(i,'Nie można nałożyć/zdjąć timeoutu tej osobie. Sprawdź rolę Administrator oraz hierarchię bota.');return true;}
    if(name==='kick'&&!target.kickable||name==='ban'&&!target.bannable){await fail(i,'Bot nie może zarządzać tą osobą. Sprawdź hierarchię ról.');return true;}
    let title,detail;
    if(name==='timeout'){
      const minutes=i.options.getInteger('minuty',true);await target.timeout(minutes*60000,reason(i));
      title='Nałożono timeout';detail=`Czas: **${fmt(minutes)} min** • koniec ${stamp(Date.now()+minutes*60000,'f')}`;
    }else if(name==='untimeout'){
      if(!target.communicationDisabledUntilTimestamp||target.communicationDisabledUntilTimestamp<=Date.now()){await fail(i,'Ta osoba nie ma aktywnego timeoutu.');return true;}
      await target.timeout(null,reason(i));title='Zakończono timeout';detail='Osoba może ponownie korzystać z komunikacji.';
    }else if(name==='kick'){
      await target.kick(reason(i));title='Osoba wyrzucona';detail='Może ponownie dołączyć przez zaproszenie.';
    }else{
      await target.ban({reason:reason(i),deleteMessageSeconds:0});title='Osoba zbanowana';detail='Wiadomości pozostawiono na serwerze.';
    }
    await done(i,title,`Osoba: <@${target.id}>\n${detail}\nPowód: **${safe(why)}**`);
    await logStaffAction(i.guild,title,i.user.id,target.id,`${detail}\nPowód: ${why}`);return true;
  }
  if(name==='unban'){
    const id=i.options.getString('id',true).trim(),why=i.options.getString('powod',true).trim();
    if(!/^\d{17,21}$/.test(id)||!why){await fail(i,'Podaj prawidłowe ID użytkownika i niepusty powód.');return true;}
    const banned=await i.guild.bans.fetch(id).catch(e=>{if(e.code===10026)return null;throw e;});
    if(!banned){await fail(i,'Ta osoba nie ma bana na serwerze.');return true;}
    await i.guild.bans.remove(id,reason(i));await done(i,'Zdjęto bana',`Osoba: <@${id}>\nPowód: **${safe(why)}**`);
    await logStaffAction(i.guild,'Zdjęto bana',i.user.id,id,why);return true;
  }
  if(['slowmode','zamknij','otworz'].includes(name)){
    const channel=i.channel;
    if(![ChannelType.GuildText,ChannelType.GuildAnnouncement].includes(channel?.type)){
      await fail(i,'Użyj komendy na zwykłym kanale tekstowym lub kanale ogłoszeń serwera.');return true;
    }
    if(name==='slowmode'){
      const seconds=i.options.getInteger('sekundy',true);await channel.setRateLimitPerUser(seconds,`Zmiana przez ${i.user.username}`);
      await done(i,seconds?'Slowmode włączony':'Slowmode wyłączony',`<#${channel.id}> • odstęp: **${seconds} s**.`);
      await logStaffAction(i.guild,'Slowmode',i.user.id,null,`<#${channel.id}>: ${seconds} s`);return true;
    }
    const saved=store.channelLock(channel.id);
    if(name==='zamknij'){
      if(saved){await fail(i,'Ten kanał ma już zapisaną blokadę. Użyj `/otworz`, aby przywrócić poprzednie ustawienie.');return true;}
      const overwrite=channel.permissionOverwrites.cache.get(guild);
      const previous=overwrite?.allow.has(P.SendMessages)?1:overwrite?.deny.has(P.SendMessages)?0:null;
      store.saveChannelLock(guild,channel.id,previous);
      try{await channel.permissionOverwrites.edit(guild,{SendMessages:false},{reason:`Zamknięcie przez ${i.user.username}`});}
      catch(error){store.deleteChannelLock(channel.id);throw error;}
      await done(i,'Kanał zamknięty dla @everyone','Zapisano poprzednie uprawnienie pisania. Przywrócisz je przez `/otworz`.\nOddzielne zezwolenia ról i członków oraz Administrator nadal mogą umożliwiać pisanie.');
    }else{
      if(!saved){await fail(i,'Brak blokady zapisanej przez `/zamknij`. Nie zmieniono uprawnień kanału.');return true;}
      await channel.permissionOverwrites.edit(guild,{SendMessages:saved.previous_send===null?null:Boolean(saved.previous_send)},{reason:`Przywrócenie przez ${i.user.username}`});
      store.deleteChannelLock(channel.id);await done(i,'Przywrócono uprawnienia kanału','Prawo pisania @everyone wróciło do stanu sprzed `/zamknij`.');
    }
    await logStaffAction(i.guild,name==='zamknij'?'Zamknięcie kanału':'Przywrócenie kanału',i.user.id,null,`<#${channel.id}>`);return true;
  }
  if(name==='rola'){
    const target=await targetMember(i),role=i.options.getRole('rola',true),action=i.options.getSubcommand();
    if(!await checkActor(i,target))return true;
    if(i.user.id!==i.guild.ownerId&&i.member.roles.highest.comparePositionTo(role)<=0){await denyPermission(i,'Rola wyższa niż rola, którą chcesz nadać lub zdjąć');return true;}
    if(!canModerate(i,target)||role.id===guild||role.managed||!role.editable||
      (i.user.id!==i.guild.ownerId&&i.member.roles.highest.comparePositionTo(role)<=0)){
      await fail(i,'Rola oraz osoba muszą być niżej w hierarchii. Nie można edytować @everyone ani ról zarządzanych przez integracje.');return true;
    }
    const has=target.roles.cache.has(role.id);
    if(action==='nadaj'&&has||action==='zdejmij'&&!has){await done(i,'Brak zmian',action==='nadaj'?'Osoba ma już tę rolę.':'Osoba nie ma tej roli.');return true;}
    if(action==='nadaj')await target.roles.add(role,`Nadano przez ${i.user.username}`);else await target.roles.remove(role,`Zdjęto przez ${i.user.username}`);
    await done(i,action==='nadaj'?'Rola nadana':'Rola zdjęta',`Osoba: <@${target.id}>\nRola: <@&${role.id}>`);
    await logStaffAction(i.guild,'Zmiana roli',i.user.id,target.id,`${action}: ${role.name} (${role.id})`);return true;
  }
  if(name==='xp'||name==='monety_admin'){
    const target=await targetMember(i),action=i.options.getSubcommand(),value=i.options.getInteger('ilosc',true);
    if(!target||target.user.bot){await fail(i,'Wybierz osobę z serwera, która nie jest botem.');return true;}
    if(name==='xp'){
      const result=action==='ustaw'?store.setXp(guild,target.id,value):store.changeXp(guild,target.id,action==='dodaj'?value:-value);
      const synced=await syncLevelRoles(target,result.level);
      await done(i,'Zapisano korektę XP',`Osoba: <@${target.id}>\nXP: **${fmt(result.xp)}** • poziom: **${result.level}**.\nKorekta nie wypłaca monet.${synced===false?'\nNie udało się zsynchronizować roli — sprawdź `/diagnostyka`.':''}`);
      await logStaffAction(i.guild,'Korekta XP',i.user.id,target.id,`${action} ${value}; teraz ${result.xp} XP`);
    }else{
      const balance=action==='ustaw'?store.setBalance(guild,target.id,value):store.changeBalance(guild,target.id,action==='dodaj'?value:-value);
      await done(i,'Zapisano korektę monet',`Osoba: <@${target.id}>\nSaldo: **${fmt(balance)} ZC**.\nZmiana widoczna w historii portfela.`);
      await logStaffAction(i.guild,'Korekta monet',i.user.id,target.id,`${action} ${value}; teraz ${balance} ZC`);
    }
    return true;
  }
  return false;
}
