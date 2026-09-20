import { pathToFileURL } from 'node:url';
import { config, assertConfig } from './config.js';
import { commandPayload } from './commands.js';
import { cleanAndSyncCommands, clearAllCommands, commandStatus, syncGuildCommands } from './command-manager.js';

export async function register(clientId,{clean=false}={}){
  const result=clean?await cleanAndSyncCommands(clientId,commandPayload):await syncGuildCommands(clientId,commandPayload);
  const count=clean?result.guild.count:result.count;
  console.log(`${clean?'Wyczyszczono globalne duchy i z':'Z'}arejestrowano ${count} komend serwerowych.`);
  return result;
}

async function main(){
  assertConfig({deployment:true});
  if(process.argv.includes('--status')){
    const status=await commandStatus(config.clientId,commandPayload);
    console.log(JSON.stringify(status,null,2));return;
  }
  if(process.argv.includes('--clear-all')){
    const result=await clearAllCommands(config.clientId);console.log('Usunięto wszystkie komendy:',result);return;
  }
  await register(config.clientId,{clean:process.argv.includes('--clean')});
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){main().catch(e=>{console.error(e);process.exitCode=1;});}
