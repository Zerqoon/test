import { REST, Routes } from 'discord.js';
import { config } from './config.js';

const restFor = () => new REST({version:'10'}).setToken(config.token);
const normalize = rows => rows.map(c=>c.name).sort((a,b)=>a.localeCompare(b,'pl'));

export async function commandStatus(clientId, desiredPayload, guildId=config.guildId){
  const rest=restFor();
  const [globalCommands,guildCommands]=await Promise.all([
    rest.get(Routes.applicationCommands(clientId)),
    rest.get(Routes.applicationGuildCommands(clientId,guildId)),
  ]);
  const desired=new Set(desiredPayload.map(c=>c.name));
  const globalNames=normalize(globalCommands),guildNames=normalize(guildCommands);
  return {
    desired:desiredPayload.length,
    guild:guildNames.length,
    global:globalNames.length,
    staleGuild:guildNames.filter(name=>!desired.has(name)),
    missingGuild:[...desired].filter(name=>!guildNames.includes(name)).sort((a,b)=>a.localeCompare(b,'pl')),
    globalNames,
    guildNames,
  };
}

export async function syncGuildCommands(clientId, desiredPayload, guildId=config.guildId){
  const rest=restFor();
  const rows=await rest.put(Routes.applicationGuildCommands(clientId,guildId),{body:desiredPayload});
  return {count:rows.length,names:normalize(rows)};
}

export async function clearGlobalCommands(clientId){
  const rest=restFor();
  const previous=await rest.get(Routes.applicationCommands(clientId));
  await rest.put(Routes.applicationCommands(clientId),{body:[]});
  return {removed:previous.length,names:normalize(previous)};
}

export async function cleanAndSyncCommands(clientId, desiredPayload, guildId=config.guildId){
  // Globalne slash commands są najczęstszą przyczyną "duchów" po zmianie projektu.
  // Guild PUT atomowo zastępuje listę serwerową, więc stare nazwy znikają bez ręcznego kasowania każdej z nich.
  const global=await clearGlobalCommands(clientId);
  const guild=await syncGuildCommands(clientId,desiredPayload,guildId);
  return {global,guild};
}

export async function clearAllCommands(clientId,guildId=config.guildId){
  const rest=restFor();
  const [globalBefore,guildBefore]=await Promise.all([
    rest.get(Routes.applicationCommands(clientId)),
    rest.get(Routes.applicationGuildCommands(clientId,guildId)),
  ]);
  await Promise.all([
    rest.put(Routes.applicationCommands(clientId),{body:[]}),
    rest.put(Routes.applicationGuildCommands(clientId,guildId),{body:[]}),
  ]);
  return {globalRemoved:globalBefore.length,guildRemoved:guildBefore.length};
}
