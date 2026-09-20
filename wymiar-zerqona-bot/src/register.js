import { pathToFileURL } from 'node:url';
import { REST, Routes } from 'discord.js';
import { config, assertConfig } from './config.js';
import { commandPayload } from './commands.js';

export async function register(clientId){
  const rest=new REST({version:'10'}).setToken(config.token);
  const commands=await rest.put(Routes.applicationGuildCommands(clientId,config.guildId),{body:commandPayload});
  console.log(`Zarejestrowano ${commands.length} komend serwerowych.`);
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  assertConfig({deployment:true});
  register(config.clientId).catch(e=>{console.error(e);process.exitCode=1;});
}
