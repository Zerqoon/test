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
  const needed = ['ManageRoles','ManageChannels','MoveMembers','ModerateMembers','BanMembers','KickMembers','ManageNicknames','ManageMessages','ViewAuditLog'];
  for (const name of needed) lines.push(`${me.permissions.has(flags[name]) ? '✅' : '❌'} Uprawnienie serwera: ${name}`);
  for (const [kind, id] of Object.entries(config.channels)) {
    if (!id && ['rules', 'rolesPanel'].includes(kind)) continue;
    const channel = guild.channels.cache.get(id);
    if (!id) { lines.push(`⚠️ Kanał ${kind}: nieprzypisany — uzupełnij config.json, jeśli chcesz go używać.`); continue; }
    if (!channel) { lines.push(`❌ Kanał ${kind}: ${id} — brak na tym serwerze`); continue; }
    const voice = kind === 'voiceCreator';
    const validType = voice ? channel.type === ChannelType.GuildVoice : [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type);
    lines.push(`${validType ? '✅' : '❌'} Kanał ${kind}: #${channel.name}`);
    const perms = channel.permissionsFor(me);
    const required = voice ? ['ViewChannel','Connect','MoveMembers','ManageChannels','ManageRoles','SendMessages'] : ['ViewChannel','SendMessages','EmbedLinks','AttachFiles','ReadMessageHistory'];
    for (const name of required) if (!perms?.has(flags[name])) lines.push(`❌ ${kind}: brakuje ${name}`);
  }
  const roles = [...config.roles.auto, ...(config.roles.selfAssignable ?? []), ...Object.values(config.roles.levels)];
  for (const id of new Set(roles)) {
    const role = guild.roles.cache.get(id);
    lines.push(`${role?.editable ? '✅' : '❌'} Rola nadawana: ${role?.name ?? id}${role && !role.editable ? ' — ustaw rolę bota wyżej' : ''}`);
    if (role && (config.roles.selfAssignable ?? []).includes(id) && role.permissions.bitfield !== 0n) lines.push(`❌ Rola samoobsługowa ${role.name} ma uprawnienia — nie udostępniaj jej do samodzielnego nadawania.`);
  }
  if (config.tickets?.categoryId) {
    const category = guild.channels.cache.get(config.tickets.categoryId);
    if (!category || category.type !== ChannelType.GuildCategory) lines.push('❌ Kategoria ticketów: brak lub nieprawidłowy typ. Sprawdź `tickets.categoryId`.');
    else lines.push(`✅ Kategoria ticketów: ${category.name} (${category.id}). Dostęp do poszczególnych ticketów jest ustawiany osobno.`);
  }
  for (const [kind, label] of [['owner','Owner'],['admin','Admin'],['moderator','Moderator'],['veteran','Weteran'],['booster','Booster']]) {
    const id = config.roles[kind];
    const role = id ? guild.roles.cache.get(id) : null;
    lines.push(`${role ? '✅' : '❌'} Rola ${label}: ${role?.name ?? id ?? 'nie skonfigurowano'}`);
  }
  const chatChannels = guild.channels.cache.filter(c => c.isTextBased() && !c.isThread());
  const noModeration = chatChannels.filter(c => {
    const p = c.permissionsFor(me); return !p?.has(flags.ViewChannel) || !p.has(flags.ManageMessages);
  });
  if (noModeration.size) lines.push(`⚠️ Filtrowanie może nie działać w: ${noModeration.map(c => `#${c.name}`).join(', ')}`);
  lines.push(`✅ Właściciele bota (dostęp po ID bez ról): ${config.ownerIds.join(', ')}`);
  lines.push('ℹ️ Logi wiadomości, kont, voice i działań administracyjnych są rozdzielone według konfiguracji.');
  return lines;
}
export async function handleDiagnosticCommand(i) {
  if (!['konfiguracja','powitanie-test'].includes(i.commandName)) return false;
  if (staffTier(i.member) < 2 && !i.memberPermissions?.has(PermissionsBitField.Flags.Administrator) && !config.ownerIds.includes(i.user.id)) { await i.reply({ content: 'Ta komenda wymaga Administratora lub roli WIDMO Admina.', flags: MessageFlags.Ephemeral }); return true; }
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  if (i.commandName === 'powitanie-test') {
    await i.editReply({ files: [new AttachmentBuilder(await welcomeCard(i.member), { name: 'powitanie.png' })] }); return true;
  }
  const lines = await diagnose(i.guild);
  const report = lines.join('\n');
  await i.editReply({ embeds: [embed('🔧 Sprawdzenie konfiguracji', report.slice(0, 3900))], files: [new AttachmentBuilder(Buffer.from(report), { name: 'konfiguracja.txt' })], allowedMentions: { parse: [] } });
  return true;
}
