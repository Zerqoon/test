import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder,
  MessageFlags, ModalBuilder, PermissionFlagsBits, TextInputBuilder,
  TextInputStyle, UserSelectMenuBuilder,
} from 'discord.js';
import { config } from './config.js';

const creating=new Set();
const cleanupTimers=new Map();
const locks=new Set();
const neat=name=>name.replace(/[\r\n<>@]/g,'').trim().slice(0,35) || 'Gracz';
const button=(name,label,style,id,emoji)=>new ButtonBuilder().setCustomId(`room:${name}:${id}`).setLabel(label).setStyle(style).setEmoji(emoji);

function panel(room,channel){
  const locked=channel.permissionOverwrites.cache.get(channel.guild.id)?.deny.has(PermissionFlagsBits.Connect) || false;
  const hidden=channel.permissionOverwrites.cache.get(channel.guild.id)?.deny.has(PermissionFlagsBits.ViewChannel) || false;
  return {
    embeds:[new EmbedBuilder().setColor(0xA76CFF).setTitle('✦ TWÓJ POKÓJ · PANEL STEROWANIA')
      .setDescription(`Właściciel: <@${room.owner_id}>\nZmień nazwę i limit, zapraszaj lub blokuj osoby. Pokój zniknie po opróżnieniu.\n\n**Dostęp:** ${locked?'zamknięty':'otwarty'}  •  **Widoczność:** ${hidden?'ukryty':'publiczny'}`)
      .setFooter({text:'Działa również komenda /pokoj podczas pobytu w kanale.'})],
    components:[
      new ActionRowBuilder().addComponents(
        button('rename','Nazwa',ButtonStyle.Primary,channel.id,'✏️'),
        button('limit','Limit',ButtonStyle.Secondary,channel.id,'👥'),
        button('lock',locked?'Otwórz':'Zamknij',locked?ButtonStyle.Success:ButtonStyle.Secondary,channel.id,'🔒'),
        button('hide',hidden?'Pokaż':'Ukryj',ButtonStyle.Secondary,channel.id,'👁️')),
      new ActionRowBuilder().addComponents(
        button('invite','Dodaj',ButtonStyle.Success,channel.id,'➕'),
        button('block','Zablokuj osobę',ButtonStyle.Danger,channel.id,'⛔'),
        button('unblock','Odblokuj',ButtonStyle.Secondary,channel.id,'🔓'),
        button('kick','Odłącz',ButtonStyle.Secondary,channel.id,'↪️')),
      new ActionRowBuilder().addComponents(
        button('transfer','Przekaż pokój',ButtonStyle.Primary,channel.id,'👑'),
        button('claim','Przejmij wolny',ButtonStyle.Secondary,channel.id,'🙋'),
        button('delete','Usuń pokój',ButtonStyle.Danger,channel.id,'🗑️')),
    ],
  };
}

export async function refreshPanel(channel,room){
  if (!room?.panel_id) return;
  try { const msg=await channel.messages.fetch(room.panel_id); await msg.edit(panel(room,channel)); }
  catch (e) { console.warn('Nie można odświeżyć panelu głosowego:',e.message); }
}

async function createRoom(member,store){
  const guild=member.guild, lobby=guild.channels.cache.get(config.channels.voiceLobby);
  if(!lobby || lobby.type!==ChannelType.GuildVoice) throw new Error('Nie znaleziono kanału lobby (musi być głosowy).');
  const existing=store.ownerRoom(guild.id,member.id);
  if(existing){
    const channel=guild.channels.cache.get(existing.channel_id);
    if(channel){await member.voice.setChannel(channel,'Powrót do własnego pokoju');return;}
    store.deleteRoom(existing.channel_id);
  }
  const overwrites=lobby.permissionOverwrites.cache.map(o=>({id:o.id,type:o.type,allow:o.allow.bitfield,deny:o.deny.bitfield}));
  const own=overwrites.find(o=>o.id===member.id);
  if(own){own.allow=BigInt(own.allow)|PermissionFlagsBits.ViewChannel|PermissionFlagsBits.Connect;own.deny=BigInt(own.deny)&~(PermissionFlagsBits.ViewChannel|PermissionFlagsBits.Connect);}
  else overwrites.push({id:member.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.Connect]});
  let channel;
  try{
    channel=await guild.channels.create({name:`✦ ${neat(member.displayName)} • pokój`,type:ChannelType.GuildVoice,
      parent:lobby.parentId,permissionOverwrites:overwrites,userLimit:0,reason:`Pokój użytkownika ${member.user.username} (${member.id})`});
    store.saveRoom(guild.id,channel.id,member.id);
    await member.voice.setChannel(channel,'Utworzono prywatny pokój');
    try {const msg=await channel.send(panel(store.room(channel.id),channel));store.setPanel(channel.id,msg.id);}
    catch(e){console.warn('Panel w czacie głosowym niedostępny; działa /pokoj:',e.message);}
  }catch(e){if(channel){await channel.delete('Nie udało się utworzyć pokoju').catch(()=>{});store.deleteRoom(channel.id);}throw e;}
}

export function scheduleRoomCleanup(channelId,client,store,delay=30000){
  if(cleanupTimers.has(channelId)) clearTimeout(cleanupTimers.get(channelId));
  const timer=setTimeout(async()=>{
    cleanupTimers.delete(channelId);
    const room=store.room(channelId);if(!room)return;
    try{
      const channel=await client.channels.fetch(channelId).catch(()=>null);
      if(!channel){store.deleteRoom(channelId);return;}
      if(channel.members?.size) return;
      await channel.delete('Pokój głosowy jest pusty');
      store.deleteRoom(channelId);
    }catch(e){console.error('Nie udało się usunąć pustego pokoju:',e);}
  },delay);
  timer.unref();cleanupTimers.set(channelId,timer);
}

export async function reconcileRooms(client,store){
  for(const room of store.rooms()){
    const channel=await client.channels.fetch(room.channel_id).catch(()=>null);
    if(!channel){store.deleteRoom(room.channel_id);continue;}
    if(!channel.members?.size)scheduleRoomCleanup(channel.id,client,store,60000);
  }
}

export async function handleVoiceRooms(oldState,newState,store,client){
  if(oldState.channelId===newState.channelId)return;
  if(oldState.channelId && store.room(oldState.channelId)) scheduleRoomCleanup(oldState.channelId,client,store);
  if(newState.channelId && cleanupTimers.has(newState.channelId)){
    clearTimeout(cleanupTimers.get(newState.channelId));cleanupTimers.delete(newState.channelId);
  }
  if(newState.channelId!==config.channels.voiceLobby || newState.member?.user.bot)return;
  const key=`${newState.guild.id}:${newState.id}`;
  if(creating.has(key))return;
  creating.add(key);
  try{await createRoom(newState.member,store);}
  catch(e){console.error('Tworzenie pokoju:',e);}
  finally{creating.delete(key);}
}

const ephemeral=(i,content)=>i.deferred?i.editReply({content,components:[]}):
  i.reply({content,flags:MessageFlags.Ephemeral});
function selectedRoom(i,store){
  const ownChannel=i.member?.voice?.channel;
  const room=ownChannel && store.room(ownChannel.id);
  return room && {room,channel:ownChannel};
}
export async function showRoomPanel(i,store){
  const found=selectedRoom(i,store);
  if(!found)return ephemeral(i,'Wejdź do swojego pokoju głosowego, aby otworzyć panel.');
  return i.reply({...panel(found.room,found.channel),flags:MessageFlags.Ephemeral});
}

const choiceActions=new Set(['invite','block','unblock','kick','transfer']);
export async function handleRoomInteraction(i,store){
  if(!(i.isButton()||i.isUserSelectMenu()||i.isModalSubmit()))return false;
  if(!i.customId.startsWith('room:'))return false;
  const [prefix,action,id]=i.customId.split(':');
  if(prefix!=='room'||!action||!id)return true;
  const room=store.room(id),channel=await i.guild.channels.fetch(id).catch(()=>null);
  if(!room||!channel||channel.type!==ChannelType.GuildVoice){await ephemeral(i,'Ten pokój już nie istnieje.');return true;}
  if(locks.has(id)){await ephemeral(i,'Trwa zmiana ustawień tego pokoju. Spróbuj ponownie.');return true;}
  const isStaff=i.member.roles.cache.has(config.roles.chief)||i.member.roles.cache.has(config.roles.moderator)||i.member.id===i.guild.ownerId;
  const inRoom=i.member.voice.channelId===id;
  const owner=room.owner_id===i.user.id;
  if(action==='claim'){
    if(!inRoom){await ephemeral(i,'Musisz być w tym pokoju, aby go przejąć.');return true;}
    if(channel.members.has(room.owner_id)){await ephemeral(i,'Właściciel nadal jest w pokoju.');return true;}
  }else if(!owner&&!isStaff){await ephemeral(i,'Tylko właściciel pokoju lub moderator może zmienić jego ustawienia.');return true;}

  if(i.isButton()&&['rename','limit'].includes(action)){
    const modal=new ModalBuilder().setCustomId(`room:modal_${action}:${id}`).setTitle(action==='rename'?'Zmień nazwę pokoju':'Ustaw limit osób');
    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder()
      .setCustomId('value').setLabel(action==='rename'?'Nazwa pokoju (1–35 znaków)':'Limit: 0 (bez limitu) lub 1–99')
      .setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(action==='rename'?35:2).setRequired(true)));
    await i.showModal(modal);return true;
  }
  if(i.isButton()&&choiceActions.has(action)){
    const menu=new UserSelectMenuBuilder().setCustomId(`room:select_${action}:${id}`).setPlaceholder('Wybierz osobę').setMinValues(1).setMaxValues(1);
    await i.reply({content:'Wybierz użytkownika:',components:[new ActionRowBuilder().addComponents(menu)],flags:MessageFlags.Ephemeral});return true;
  }
  if(i.isButton()&&action==='delete'){
    const row=new ActionRowBuilder().addComponents(button('confirm','Tak, usuń pokój',ButtonStyle.Danger,id,'🗑️'));
    await i.reply({content:'Usunięcie pokoju rozłączy wszystkich rozmówców. Potwierdź:',components:[row],flags:MessageFlags.Ephemeral});return true;
  }

  locks.add(id);
  try{
    await i.deferReply({flags:MessageFlags.Ephemeral});
    let note='Zapisano ustawienia pokoju.';
    if(i.isModalSubmit()&&action==='modal_rename'){
      const name=neat(i.fields.getTextInputValue('value'));
      await channel.setName(`✦ ${name} • pokój`,'Panel właściciela');note=`Nowa nazwa: **${name}**`;
    }else if(i.isModalSubmit()&&action==='modal_limit'){
      const val=i.fields.getTextInputValue('value').trim();
      if(!/^(?:0|[1-9][0-9]?)$/.test(val)){await ephemeral(i,'Podaj liczbę od 0 do 99.');return true;}
      await channel.setUserLimit(Number(val),'Panel właściciela');note=`Limit osób: **${Number(val)||'bez limitu'}**`;
    }else if(i.isButton()&&['lock','hide'].includes(action)){
      const bit=action==='lock'?PermissionFlagsBits.Connect:PermissionFlagsBits.ViewChannel;
      const isDenied=channel.permissionOverwrites.cache.get(i.guild.id)?.deny.has(bit)||false;
      const patch=action==='lock'?{Connect:isDenied?null:false}:{ViewChannel:isDenied?null:false};
      await channel.permissionOverwrites.edit(i.guild.id,patch,{reason:'Panel właściciela'});
      note=action==='lock'?(isDenied?'Pokój otwarty.':'Pokój zamknięty. Nowe osoby wymagają zaproszenia.'):(isDenied?'Pokój widoczny.':'Pokój ukryty.');
    }else if(i.isUserSelectMenu()&&action.startsWith('select_')){
      const mode=action.slice(7),userId=i.values[0];
      const target=await i.guild.members.fetch(userId).catch(()=>null);
      if(!target||target.user.bot){await ephemeral(i,'Wybierz prawidłową osobę z serwera.');return true;}
      if(mode==='invite'){
        await channel.permissionOverwrites.edit(userId,{ViewChannel:true,Connect:true},{reason:'Zaproszenie przez właściciela'});
        note=`Zaproszono <@${userId}>. Może wejść również do zamkniętego pokoju.`;
      }else if(mode==='block'){
        if(userId===room.owner_id||target.permissions.has(PermissionFlagsBits.Administrator)){await ephemeral(i,'Nie można zablokować właściciela ani administratora.');return true;}
        await channel.permissionOverwrites.edit(userId,{ViewChannel:false,Connect:false},{reason:'Blokada przez właściciela'});
        if(target.voice.channelId===id)await target.voice.disconnect('Zablokowano w pokoju');
        note=`Zablokowano <@${userId}>.`;
      }else if(mode==='unblock'){
        if(userId===room.owner_id){await ephemeral(i,'Właściciel ma zawsze dostęp.');return true;}
        await channel.permissionOverwrites.delete(userId,'Odblokowano w pokoju');note=`Usunięto indywidualne uprawnienia <@${userId}>.`;
      }else if(mode==='kick'){
        if(target.voice.channelId!==id||userId===room.owner_id){await ephemeral(i,'Ta osoba nie jest w pokoju albo jest jego właścicielem.');return true;}
        await target.voice.disconnect('Odłączono z pokoju głosowego');note=`Odłączono <@${userId}>.`;
      }else if(mode==='transfer'){
        if(target.voice.channelId!==id){await ephemeral(i,'Nowy właściciel musi być w pokoju.');return true;}
        const other=store.ownerRoom(i.guild.id,userId);
        if(other&&other.channel_id!==id){await ephemeral(i,'Ta osoba ma już własny pokój.');return true;}
        await channel.permissionOverwrites.edit(userId,{ViewChannel:true,Connect:true},{reason:'Przekazanie pokoju'});
        if(room.owner_id!==userId)await channel.permissionOverwrites.delete(room.owner_id,'Przekazanie pokoju').catch(()=>{});
        store.setOwner(id,userId);note=`Nowy właściciel: <@${userId}>.`;
      }else{await ephemeral(i,'Nieznana operacja.');return true;}
    }else if(i.isButton()&&action==='claim'){
      const other=store.ownerRoom(i.guild.id,i.user.id);
      if(other&&other.channel_id!==id){await ephemeral(i,'Masz już własny pokój.');return true;}
      await channel.permissionOverwrites.edit(i.user.id,{ViewChannel:true,Connect:true},{reason:'Przejęcie pustego pokoju'});
      await channel.permissionOverwrites.delete(room.owner_id,'Przejęcie pokoju').catch(()=>{});
      store.setOwner(id,i.user.id);note='Pokój został przejęty.';
    }else if(i.isButton()&&action==='confirm'){
      await channel.delete(`Pokój usunięty przez ${i.user.username}`);store.deleteRoom(id);
      await ephemeral(i,'Pokój został usunięty.');return true;
    }else{await ephemeral(i,'Nieznana akcja.');return true;}
    await ephemeral(i,note);
    await refreshPanel(channel,store.room(id));
  }catch(e){console.error('Panel pokoju:',e);if(i.deferred||!i.replied)await ephemeral(i,'Nie udało się zmienić ustawień. Sprawdź uprawnienia bota i hierarchię ról.');}
  finally{locks.delete(id);}
  return true;
}
