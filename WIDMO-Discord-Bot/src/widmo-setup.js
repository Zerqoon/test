import { SlashCommandBuilder, ChannelType, PermissionFlagsBits as P, MessageFlags } from 'discord.js';
import { config } from './config.js';
import { getSetting, setSetting } from './db.js';
import { embed, isBotOwner } from './shared.js';
import { ensureLevelInfo } from './levels.js';
import { ensureRulesPanel } from './commands.js';
import { ensureTicketPanel } from './community.js';

const setupCommand = new SlashCommandBuilder()
  .setName('widmo-setup')
  .setDescription('Sprawdź konfigurację bota, kanałów, ról i odśwież panele.');
export const widmoSetupCommands = [setupCommand];

const scopedSetting = (guildId, key) => `widmo:${guildId || 'default'}:${key}`;

export function loadPersistedWidmoConfig(guildId = config.guildId) {
  try {
    const configuredChannels = Object.fromEntries(Object.entries(config.channels ?? {}).filter(([, value]) => Boolean(value)));
    const configuredAutoRoles = [...(config.roles.auto ?? [])];
    const configuredStaffRoles = Object.fromEntries(['owner', 'admin', 'moderator', 'booster', 'veteran'].map(k => [k, config.roles[k]]).filter(([, v]) => Boolean(v)));
    const configuredLevels = { ...(config.roles.levels ?? {}) };

    const channels = getSetting(scopedSetting(guildId, 'channels')) ?? getSetting('widmo:channels');
    if (channels) Object.assign(config.channels, JSON.parse(channels));
    Object.assign(config.channels, configuredChannels);
    // These optional channels were not provided by the owner; don't revive stale IDs or generate replacements.
    if (!configuredChannels.rules) config.channels.rules = '';
    if (!configuredChannels.rolesPanel) config.channels.rolesPanel = '';

    // The provided ticket category is authoritative. An empty voice category means "use the creator channel's parent".
    if (!config.voice.categoryId) config.voice.categoryId = '';
    if (!config.tickets?.categoryId) {
      const ticketCategory = getSetting(scopedSetting(guildId, 'ticket-category')) ?? getSetting('widmo:ticket-category');
      if (ticketCategory && config.tickets) config.tickets.categoryId = ticketCategory;
    }

    const savedRoles = getSetting(scopedSetting(guildId, 'roles')) ?? getSetting('widmo:roles');
    if (savedRoles) {
      const saved = JSON.parse(savedRoles);
      Object.assign(config.roles, saved, configuredStaffRoles);
      config.roles.auto = configuredAutoRoles.length ? configuredAutoRoles : (saved.auto ?? []);
      config.roles.levels = Object.keys(configuredLevels).length ? configuredLevels : (saved.levels ?? {});
      // Keep only configured role systems; legacy helper/self-assignable roles are not used.
      config.roles.selfAssignable = [];
      delete config.roles.helper;
      if (guildId) setSetting(scopedSetting(guildId, 'roles'), JSON.stringify({ ...config.roles, selfAssignable: [] }));
    }
    Object.assign(config.roles, configuredStaffRoles);
    config.roles.auto = configuredAutoRoles;
    config.roles.levels = Object.keys(configuredLevels).length ? configuredLevels : (config.roles.levels ?? {});
    config.roles.selfAssignable = [];
    delete config.roles.helper;
  } catch (error) {
    console.error('[WIDMO config] Nie udało się odczytać starszych ustawień:', error.message);
  }
}

const channelChecks = [
  ['welcome', 'kanał powitań', 'text'],
  ['rules', 'kanał regulaminu', 'text'],
  ['levels', 'kanał panelu poziomów', 'text'],
  ['voiceCreator', 'kanał tworzenia voice', 'voice'],
  ['ticketPanel', 'kanał panelu ticketów', 'text'],
  ['suggestions', 'kanał sugestii', 'text'],
  ['messages', 'logi wiadomości', 'text'],
  ['voiceLogs', 'logi voice', 'text'],
  ['members', 'logi wejść/wyjść', 'text'],
  ['moderation', 'logi działań administracyjnych', 'text'],
  ['actions', 'logi audytu', 'text'],
];
const roleChecks = [
  ['owner', 'Owner', false], ['admin', 'Admin', false], ['moderator', 'Moderator', false],
  ['booster', 'Booster', false], ['veteran', 'Weteran', false],
];

export async function handleWidmoSetup(interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'widmo-setup') return false;
  const permitted = interaction.memberPermissions?.has(P.Administrator) || isBotOwner(interaction.user.id);
  if (!permitted) {
    await interaction.reply({ content: 'Ta komenda wymaga uprawnienia Administratora albo dostępu właściciela bota.', flags: MessageFlags.Ephemeral });
    return true;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const guild = interaction.guild;
    if (!guild || guild.id !== config.guildId) throw new Error('Komenda jest dostępna tylko na skonfigurowanym serwerze.');
    await guild.roles.fetch();
    await guild.channels.fetch();
    const lines = [];
    const me = await guild.members.fetchMe();

    for (const [key, label, expected] of channelChecks) {
      const id = config.channels[key];
      if (!id) { lines.push(`⚠️ ${label}: nie ustawiono ID w config.json.`); continue; }
      const channel = guild.channels.cache.get(id);
      if (!channel) { lines.push(`❌ ${label}: kanał ${id} nie istnieje na tym serwerze lub bot nie może go pobrać.`); continue; }
      const valid = expected === 'voice' ? channel.type === ChannelType.GuildVoice : [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type);
      const permissions = channel.permissionsFor(me);
      const permissionsOk = expected === 'voice'
        ? permissions?.has([P.ViewChannel, P.Connect, P.MoveMembers, P.ManageChannels, P.ManageRoles])
        : permissions?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks, P.AttachFiles, P.ReadMessageHistory]);
      lines.push(`${valid && permissionsOk ? '✅' : '❌'} ${label}: ${channel} — ${valid ? (permissionsOk ? 'typ i uprawnienia OK' : 'brak wymaganych uprawnień bota') : 'nieprawidłowy typ kanału'}`);
    }

    const roleIds = [
      ...roleChecks.map(([key]) => config.roles[key]).filter(Boolean),
      ...(config.roles.auto ?? []),
      ...Object.values(config.roles.levels ?? {}),
    ];
    for (const [key, label, assignable] of roleChecks) {
      const id = config.roles[key];
      const role = id ? guild.roles.cache.get(id) : null;
      if (!role) lines.push(`❌ Rola ${label}: brak lub nieprawidłowe ID (${id || 'nieustawione'}).`);
      else lines.push(`✅ Rola ${label}: ${role.name} (${role.id})`);
    }
    for (const id of [...new Set([...(config.roles.auto ?? []), ...Object.values(config.roles.levels ?? {})])]) {
      const role = guild.roles.cache.get(id);
      if (!role) lines.push(`❌ Rola automatyczna/nagrody ${id}: nie istnieje.`);
      else if (!role.editable) lines.push(`⚠️ Rola ${role.name}: bot nie może jej nadawać — przesuń rolę bota wyżej.`);
      else lines.push(`✅ Rola do automatycznego nadawania: ${role.name}`);
    }

    const ticketCategory = config.tickets?.categoryId ? guild.channels.cache.get(config.tickets.categoryId) : null;
    if (!ticketCategory || ticketCategory.type !== ChannelType.GuildCategory) lines.push(`❌ Kategoria ticketów: ${config.tickets?.categoryId || 'nieustawiona'} — wymagane ID kategorii.`);
    else lines.push(`✅ Kategoria ticketów: ${ticketCategory.name} (${ticketCategory.id})`);

    if (!me.permissions.has(P.ManageRoles)) lines.push('❌ Bot nie ma uprawnienia Manage Roles — autorole i role za poziomy nie będą działać.');
    if (!me.permissions.has(P.ViewAuditLog)) lines.push('⚠️ Bot nie ma View Audit Log — część wpisów o działaniach administracyjnych może nie zawierać wykonawcy.');

    // Keep configuration on the persistent volume; configured IDs in config.json remain the source of truth.
    setSetting(scopedSetting(guild.id, 'channels'), JSON.stringify(config.channels));
    setSetting(scopedSetting(guild.id, 'roles'), JSON.stringify({ ...config.roles, selfAssignable: [] }));
    if (config.tickets?.categoryId) setSetting(scopedSetting(guild.id, 'ticket-category'), config.tickets.categoryId);

    let panelStatus = [];
    try { if (config.channels.rules) { const rules = await ensureRulesPanel(interaction.client, guild); panelStatus.push(`✅ Regulamin opublikowany / odświeżony: ${rules.url}`); } }
    catch (error) { panelStatus.push(`❌ Regulamin: ${error.message}`); }
    try { if (config.channels.levels) { await ensureLevelInfo(interaction.client); panelStatus.push('✅ Panel poziomów opublikowany / odświeżony.'); } }
    catch (error) { panelStatus.push(`❌ Panel poziomów: ${error.message}`); }
    try { if (config.channels.ticketPanel) { await ensureTicketPanel(interaction.client, guild); panelStatus.push('✅ Panel ticketów opublikowany / odświeżony.'); } }
    catch (error) { panelStatus.push(`❌ Panel ticketów: ${error.message}`); }

    const report = embed('Konfiguracja WIDMO • raport',
      'Bot sprawdził podane kanały i role. Nie tworzy nowych ról Owner/Admin/Moderator ani nie zmienia uprawnień istniejących ról. Role automatyczne dla obecnych członków są uzupełniane przez kolejkę po uruchomieniu bota.');
    report.addFields(
      { name: 'Kanały', value: lines.filter(line => /kanał|logi|voice|panel|sugestii/i.test(line)).join('\n').slice(0, 1000) || 'Brak danych' },
      { name: 'Role i uprawnienia', value: lines.filter(line => /rola|uprawnienie|Manage|View Audit/i.test(line)).join('\n').slice(0, 1000) || 'Brak danych' },
      { name: 'Panele', value: panelStatus.join('\n') || 'Nie odświeżono paneli.' },
    );
    await interaction.editReply({ embeds: [report], allowedMentions: { parse: [] } });
    const problems = lines.filter(line => line.startsWith('❌') || line.startsWith('⚠️'));
    console.log(`[WIDMO setup] Weryfikacja ${guild.id}: ${lines.length} sprawdzeń, ${problems.length} ostrzeżeń/błędów.`);
  } catch (error) {
    console.error('[WIDMO setup]', error);
    await interaction.editReply({ content: `Nie udało się sprawdzić konfiguracji: ${String(error.message ?? error).slice(0, 1500)}`, allowedMentions: { parse: [] } });
  }
  return true;
}
