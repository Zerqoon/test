import { Client, Events, GatewayIntentBits, Partials, MessageFlags, ActivityType } from 'discord.js';
import { config, assertConfig } from './config.js';
import { Store } from './db.js';
import { register } from './register.js';
import { handleCommand } from './commands.js';
import { handlePublicComponent } from './public-panels.js';
import { BRAND, embed } from './ui.js';
import { handleMessageXp, seedVoiceSweep, voiceXpSweep } from './experience.js';
import { handleVoiceRooms, handleRoomInteraction, reconcileRooms } from './voice.js';
import { diagnose } from './diagnostics.js';
import {
  logMessageCreate,logMessageEdit,logMessageDelete,logBulkDelete,logVoice,
  logJoin,logLeave,logMemberUpdate,logUserUpdate,logAudit,
} from './logs.js';

assertConfig();
const store=new Store(config.dataDir);
const client=new Client({
  intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildVoiceStates,GatewayIntentBits.GuildModeration],
  partials:[Partials.Message,Partials.Channel,Partials.User,Partials.GuildMember],
  allowedMentions:{parse:[]},
});
const safely=(label,fn)=>(...args)=>Promise.resolve().then(()=>fn(...args)).catch(e=>console.error(`[${label}]`,e));

client.once(Events.ClientReady,safely('ready',async()=>{
  console.log(`${BRAND.name} v${BRAND.version} • Zalogowano: ${client.user.tag} (${client.user.id})`);
  client.user.setActivity('Wymiar ZERQONA • /pomoc', { type: ActivityType.Watching });
  const guild=await client.guilds.fetch(config.guildId);
  const checks=await diagnose(guild);
  for(const line of checks.filter(s=>s.startsWith('❌')||s.startsWith('⚠️')))console.warn(line);
  await register(client.user.id).catch(e=>console.error('Nie udało się odświeżyć komend; ponów npm run deploy:',e.message));
  await reconcileRooms(client,store);
  seedVoiceSweep(client);
  console.log('Bot gotowy. Baza danych:',config.dataDir);
}));
client.on(Events.InteractionCreate,async i=>{
  try{
    if(!i.inGuild()||i.guildId!==config.guildId){
      if(i.isRepliable())await i.reply({content:'Bot działa na przypisanym serwerze.',flags:MessageFlags.Ephemeral});
      return;
    }
    if(i.isAutocomplete()) { await handleCommand(i,store); return; }
    if(await handlePublicComponent(i,store))return;
    if(await handleRoomInteraction(i,store))return;
    if(i.isChatInputCommand())await handleCommand(i,store);
  }catch(e){
    console.error('[interaction]',e);
    if(i.isAutocomplete()) { await i.respond([]).catch(()=>{}); return; }
    if(!i.isRepliable())return;
    const known={50013:'Bot nie ma wymaganych uprawnień lub jego rola jest zbyt nisko. Użyj /diagnostyka.',50001:'Bot nie ma dostępu do tego kanału lub zasobu.',10007:'Ta osoba nie jest już na serwerze.',10026:'Ta osoba nie ma aktywnego bana.',10003:'Ten kanał już nie istnieje.',50035:'Discord odrzucił dane operacji. Szczegóły zapisano w konsoli bota.'};
    const message=e instanceof RangeError?e.message:(known[e.code]||'Nie udało się zakończyć operacji. Sprawdź aktualny stan przed ponowieniem. Szczegóły są w konsoli bota.');
    const body={content:null,embeds:[embed('Operacja nie została zakończona',message,{error:true})],allowedMentions:{parse:[]}};
    try{
      if(i.deferred)await i.editReply({...body,components:[],attachments:[],files:[]});
      else if(i.replied)await i.followUp({...body,flags:MessageFlags.Ephemeral});
      else await i.reply({...body,flags:MessageFlags.Ephemeral});
    }catch(inner){console.error('[interaction response]',inner);}
  }
});
client.on(Events.MessageCreate,safely('messageCreate',async m=>{await logMessageCreate(m,store);await handleMessageXp(m,store);}));
client.on(Events.MessageUpdate,safely('messageUpdate',(oldMsg,newMsg)=>logMessageEdit(oldMsg,newMsg,store)));
client.on(Events.MessageDelete,safely('messageDelete',msg=>logMessageDelete(msg,store)));
client.on(Events.MessageBulkDelete,safely('messageBulkDelete',messages=>logBulkDelete(messages,store)));
client.on(Events.VoiceStateUpdate,safely('voiceStateUpdate',async(a,b)=>{
  if(a.guild.id!==config.guildId)return;
  await voiceXpSweep(client,store);
  await handleVoiceRooms(a,b,store,client);
  await logVoice(a,b);
}));
client.on(Events.GuildMemberAdd,safely('guildMemberAdd',m=>m.guild.id===config.guildId&&logJoin(m)));
client.on(Events.GuildMemberRemove,safely('guildMemberRemove',m=>m.guild.id===config.guildId&&logLeave(m)));
client.on(Events.GuildMemberUpdate,safely('guildMemberUpdate',(a,b)=>b.guild.id===config.guildId&&logMemberUpdate(a,b)));
client.on(Events.UserUpdate,safely('userUpdate',(a,b)=>logUserUpdate(a,b,client)));
client.on(Events.GuildAuditLogEntryCreate,safely('auditLog',(entry,guild)=>logAudit(entry,guild)));
client.on(Events.ChannelDelete,safely('channelDelete',ch=>{if(store.room(ch.id))store.deleteRoom(ch.id);}));
client.on(Events.Error,e=>console.error('[discord]',e));

const timer=setInterval(()=>{
  if(!client.isReady())return;
  voiceXpSweep(client,store).catch(e=>console.error('[voiceXp]',e));
},60000);timer.unref();
store.cleanupSnapshots();
const cleanup=setInterval(()=>{try{store.cleanupSnapshots();}catch(e){console.error('[cleanup]',e);}},12*3600000);cleanup.unref();
let shuttingDown=false;
function stop(){
  if(shuttingDown)return;shuttingDown=true;
  clearInterval(timer);clearInterval(cleanup);
  client.destroy();store.close();process.exit(0);
}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
process.on('unhandledRejection',e=>console.error('[unhandled]',e));
client.login(config.token).catch(e=>{console.error('Logowanie nieudane:',e.message);clearInterval(timer);clearInterval(cleanup);client.destroy();store.close();process.exitCode=1;});
