import { Client, Events, GatewayIntentBits, Partials, MessageFlags } from 'discord.js';
import { config, assertConfig } from './config.js';
import { Store } from './db.js';
import { register } from './register.js';
import { handleCommand } from './commands.js';
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
  console.log(`Zalogowano: ${client.user.tag} (${client.user.id})`);
  const guild=await client.guilds.fetch(config.guildId);
  const checks=await diagnose(guild);
  for(const line of checks.filter(s=>s.startsWith('❌')||s.startsWith('⚠️')))console.warn(line);
  await register(client.user.id);
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
    if(await handleRoomInteraction(i,store))return;
    if(i.isChatInputCommand())await handleCommand(i,store);
  }catch(e){
    console.error('[interaction]',e);
    if(!i.isRepliable())return;
    const message='Nie udało się wykonać operacji. Sprawdź uprawnienia bota i spróbuj ponownie.';
    try{
      if(i.deferred)await i.editReply({content:message,components:[],files:[]});
      else if(i.replied)await i.followUp({content:message,flags:MessageFlags.Ephemeral});
      else await i.reply({content:message,flags:MessageFlags.Ephemeral});
    }catch(inner){console.error('[interaction response]',inner);}
  }
});
client.on(Events.MessageCreate,safely('messageCreate',async m=>{await logMessageCreate(m,store);await handleMessageXp(m,store);}));
client.on(Events.MessageUpdate,safely('messageUpdate',(oldMsg,newMsg)=>logMessageEdit(oldMsg,newMsg,store)));
client.on(Events.MessageDelete,safely('messageDelete',msg=>logMessageDelete(msg,store)));
client.on(Events.MessageBulkDelete,safely('messageBulkDelete',messages=>logBulkDelete(messages,store)));
client.on(Events.VoiceStateUpdate,safely('voiceStateUpdate',async(a,b)=>{
  if(a.guild.id!==config.guildId)return;
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
const cleanup=setInterval(()=>store.cleanupSnapshots(),12*3600000);cleanup.unref();
let shuttingDown=false;
function stop(){
  if(shuttingDown)return;shuttingDown=true;
  clearInterval(timer);clearInterval(cleanup);
  client.destroy();store.close();process.exit(0);
}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
process.on('unhandledRejection',e=>console.error('[unhandled]',e));
client.login(config.token).catch(e=>{console.error('Logowanie nieudane:',e);store.close();process.exitCode=1;});
