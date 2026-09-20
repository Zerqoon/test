import { PermissionFlagsBits } from 'discord.js';
import { config } from './config.js';

const required=[
  ['Wyświetlanie kanałów',PermissionFlagsBits.ViewChannel],['Wysyłanie wiadomości',PermissionFlagsBits.SendMessages],
  ['Osadzanie linków',PermissionFlagsBits.EmbedLinks],['Łączenie z VC',PermissionFlagsBits.Connect],['Wysyłanie plików',PermissionFlagsBits.AttachFiles],['Czytanie historii',PermissionFlagsBits.ReadMessageHistory],
  ['Log audytowy',PermissionFlagsBits.ViewAuditLog],['Zarządzanie kanałami',PermissionFlagsBits.ManageChannels],
  ['Przenoszenie członków',PermissionFlagsBits.MoveMembers],['Zarządzanie rolami',PermissionFlagsBits.ManageRoles],
  ['Timeout',PermissionFlagsBits.ModerateMembers],['Wyrzucanie',PermissionFlagsBits.KickMembers],
  ['Banowanie',PermissionFlagsBits.BanMembers],['Zarządzanie wiadomościami',PermissionFlagsBits.ManageMessages],
  ['Dodawanie reakcji',PermissionFlagsBits.AddReactions],
];

export async function diagnose(guild){
  const lines=[];
  await guild.roles.fetch();await guild.channels.fetch();const bot=await guild.members.fetchMe();
  for(const [name,id] of Object.entries(config.channels)){
    const channel=guild.channels.cache.get(id);
    lines.push(`${channel?'✅':'❌'} ${name}: ${channel?`#${channel.name}`:'brak kanału'}`);
  }
  for(const [name,id] of Object.entries(config.roles)){
    const role=guild.roles.cache.get(id);
    lines.push(`${role?'✅':'❌'} ${name}: ${role?.name||'brak roli'}`);
  }
  for(const {level,id,name} of config.levelRoles){
    const role=guild.roles.cache.get(id);
    lines.push(`${role?.editable?'✅':'❌'} LV ${level} ${name}: ${role?.name||'brak roli / za wysoko'}`);
  }
  for(const [name,flag] of required){lines.push(`${bot.permissions.has(flag)?'✅':'❌'} Uprawnienie: ${name}`);}
  lines.push(`${bot.roles.cache.has(config.roles.bot)?'✅':'⚠️'} Rola Arcymistrz przypisana botowi`);
  return lines;
}
