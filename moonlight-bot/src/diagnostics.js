import { SlashCommandBuilder, PermissionsBitField, ChannelType, MessageFlags, AttachmentBuilder } from 'discord.js';
import { config } from './config.js';
import { staffTier, embed } from './shared.js';
import { welcomeCard } from './cards.js';

export const diagnosticCommands = [
  new SlashCommandBuilder().setName('konfiguracja').setDescription('Sprawdź kanały, role i uprawnienia bota (administracja)'),
  new SlashCommandBuilder().setName('powitanie-test').setDescription('Prywatny podgląd grafiki powitalnej (administracja)'),
];
export async function diagnose(guild) {
  const me = await guild.members.fetchMe();
  await guild.roles.fetch(); await guild.channels.fetch();
  const lines = [];
  const flags = PermissionsBitField.Flags;
  const needed = ['ManageRoles','ManageChannels','MoveMembers','ModerateMembers','BanMembers','ViewAuditLog'];
  for (const name of needed) lines.push(`${me.permissions.has(flags[name]) ? '✅' : '❌'} Uprawnienie serwera: ${name}`);
  for (const [kind, id] of Object.entries(config.channels)) {
    const channel = guild.channels.cache.get(id);
    if (!channel) { lines.push(`❌ Kanał ${kind}: ${id} — brak na tym serwerze`); continue; }
    const voice = kind === 'voiceCreator';
    const validType = voice ? channel.type === ChannelType.GuildVoice : [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type);
    lines.push(`${validType ? '✅' : '❌'} Kanał ${kind}: #${channel.name}`);
    const perms = channel.permissionsFor(me);
    const required = voice ? ['ViewChannel','Connect','MoveMembers','ManageChannels','ManageRoles','SendMessages'] : ['ViewChannel','SendMessages','EmbedLinks','AttachFiles','ReadMessageHistory'];
    for (const name of required) if (!perms?.has(flags[name])) lines.push(`❌ ${kind}: brakuje ${name}`);
  }
  const roles = [...config.roles.auto, ...Object.values(config.roles.levels)];
  for (const id of new Set(roles)) {
    const role = guild.roles.cache.get(id);
    lines.push(`${role?.editable ? '✅' : '❌'} Rola nadawana: ${role?.name ?? id}${role && !role.editable ? ' — ustaw rolę bota wyżej' : ''}`);
  }
  for (const kind of ['owner','admin','helper','veteran','booster']) {
    const role = guild.roles.cache.get(config.roles[kind]);
    lines.push(`${role ? '✅' : '❌'} Rola ${kind}: ${role?.name ?? config.roles[kind]}`);
  }
  const chatChannels = guild.channels.cache.filter(c => c.isTextBased() && !c.isThread());
  const noModeration = chatChannels.filter(c => {
    const p = c.permissionsFor(me); return !p?.has(flags.ViewChannel) || !p.has(flags.ManageMessages);
  });
  if (noModeration.size) lines.push(`⚠️ Filtrowanie może nie działać w: ${noModeration.map(c => `#${c.name}`).join(', ')}`);
  lines.push('ℹ️ Logi kont i zmian używają domyślnie tego samego kanału.');
  return lines;
}
export async function handleDiagnosticCommand(i) {
  if (!['konfiguracja','powitanie-test'].includes(i.commandName)) return false;
  if (staffTier(i.member) < 2) { await i.reply({ content: 'Ta komenda wymaga roli administratora lub Szefa.', flags: MessageFlags.Ephemeral }); return true; }
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  if (i.commandName === 'powitanie-test') {
    await i.editReply({ files: [new AttachmentBuilder(await welcomeCard(i.member), { name: 'powitanie.png' })] }); return true;
  }
  const lines = await diagnose(i.guild);
  const report = lines.join('\n');
  await i.editReply({ embeds: [embed('🔧 Sprawdzenie konfiguracji', report.slice(0, 3900))], files: [new AttachmentBuilder(Buffer.from(report), { name: 'konfiguracja.txt' })], allowedMentions: { parse: [] } });
  return true;
}
