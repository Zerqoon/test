import {
  SlashCommandBuilder, ChannelType, PermissionFlagsBits as P, MessageFlags, AttachmentBuilder,
} from 'discord.js';
import path from 'node:path';
import { config, ROOT } from './config.js';
import { getSetting, setSetting } from './db.js';
import { embed, isBotOwner } from './shared.js';

const setupCommand = new SlashCommandBuilder()
  .setName('widmo-setup')
  .setDescription('Utwórz lub uzupełnij kanały, kategorie i role w klimacie WIDMO.');
export const widmoSetupCommands = [setupCommand];

const scopedSetting = (guildId, key) => `widmo:${guildId || 'default'}:${key}`;
function readScopedSetting(guildId, key, legacyKey) {
  return getSetting(scopedSetting(guildId, key)) ?? getSetting(legacyKey);
}

export function loadPersistedWidmoConfig(guildId = config.guildId) {
  try {
    // Load only the active server's mapping. Old unscoped keys are migrated lazily
    // for users upgrading from WIDMO 2.0 with an existing persistent volume.
    const channels = readScopedSetting(guildId, 'channels', 'widmo:channels');
    if (channels) Object.assign(config.channels, JSON.parse(channels));
    const voiceCategory = readScopedSetting(guildId, 'voice-category', 'widmo:voice-category');
    if (voiceCategory) config.voice.categoryId = voiceCategory;
    const ticketCategory = readScopedSetting(guildId, 'ticket-category', 'widmo:ticket-category');
    if (ticketCategory && config.tickets) config.tickets.categoryId = ticketCategory;
    const roles = readScopedSetting(guildId, 'roles', 'widmo:roles');
    if (roles) {
      const saved = JSON.parse(roles);
      config.roles.auto = saved.auto ?? config.roles.auto;
      config.roles.selfAssignable = saved.selfAssignable ?? config.roles.selfAssignable ?? [];
      config.roles.levels = saved.levels ?? config.roles.levels;
      for (const key of ['owner', 'admin', 'helper', 'booster', 'veteran']) {
        if (saved[key] !== undefined) config.roles[key] = saved[key];
      }
      // Migrate legacy values to the selected guild namespace without deleting old data.
      if (guildId) {
        setSetting(scopedSetting(guildId, 'roles'), roles);
        if (channels) setSetting(scopedSetting(guildId, 'channels'), channels);
        if (voiceCategory) setSetting(scopedSetting(guildId, 'voice-category'), voiceCategory);
        if (ticketCategory) setSetting(scopedSetting(guildId, 'ticket-category'), ticketCategory);
      }
    }
  } catch (error) {
    console.error('[WIDMO setup] Nie udało się odczytać zapisanej konfiguracji:', error.message);
  }
}

const roleSpecs = [
  { key: 'owner', name: '♛・WIDMO OWNER', color: '#FFFFFF' },
  { key: 'admin', name: '☠・OPIEKUN CIENI', color: '#D7D7D7' },
  { key: 'helper', name: '†・STRAŻNIK KRYPTY', color: '#AFAFAF' },
  { key: 'veteran', name: '⚝・WETERAN', color: '#8D8D8D' },
  { key: 'booster', name: '✦・BOOSTER WIDMA', color: '#F4F4F4' },
  { key: 'auto', name: '☁・NOWA DUSZA', color: '#757575' },
  { key: 'self:gaming', name: '◈・GRACZ', color: '#D0D0D0' },
  { key: 'self:events', name: '✦・EVENTY', color: '#BFBFBF' },
  { key: 'self:announcements', name: '𖤐・POWIADOMIENIA', color: '#FFFFFF' },
  { key: 'self:creator', name: '✧・TWÓRCA', color: '#A5A5A5' },
  { key: 'self:voice', name: '☾・GŁOSOWY', color: '#C7C7C7' },
  { key: 'level:5', name: 'Ⅰ・ZAGUBIONA DUSZA', color: '#BEBEBE' },
  { key: 'level:10', name: 'Ⅱ・CIEŃ', color: '#D2D2D2' },
  { key: 'level:20', name: 'Ⅲ・WIDMO', color: '#FFFFFF' },
  { key: 'level:30', name: 'Ⅳ・NIEPOKORNA DUSZA', color: '#C0C0C0' },
  { key: 'level:40', name: 'Ⅴ・NIEŚMIERTELNY', color: '#969696' },
  { key: 'level:50', name: '♛・LEGENDA KRYPTY', color: '#FFFFFF' },
];

const categorySpecs = [
  { key: 'info', name: '𖤐・KRYPTA INFORMACJI' },
  { key: 'community', name: '☾・ŚWIAT ŻYWYCH' },
  { key: 'tickets', name: '☠・SALA SZEPTÓW', private: true },
  { key: 'portal', name: '⛧・PORTALE GŁOSOWE' },
  { key: 'voice', name: '☠・GŁOSY Z CIENIA' },
  { key: 'logs', name: '𖤐・ARCHIWUM CIENI', private: true },
];

const channelSpecs = [
  { key: 'welcome', name: '†・brama', type: ChannelType.GuildText, category: 'info', topic: 'Wejście do WIDMO. Przywitania nowych dusz i ważne informacje.', readonly: true },
  { key: 'rules', name: '☠・kodeks-widma', type: ChannelType.GuildText, category: 'info', topic: 'Kodeks WIDMO — zasady, których pilnuje cała społeczność.', readonly: true },
  { key: 'announcements', name: '𖤐・ogłoszenia', type: ChannelType.GuildText, category: 'info', topic: 'Oficjalne komunikaty ze świata WIDMO.', readonly: true },
  { key: 'events', name: '☾・wydarzenia', type: ChannelType.GuildText, category: 'info', topic: 'Spotkania, eventy i wspólne akcje.', readonly: true },
  { key: 'chat', name: '☁・chat', type: ChannelType.GuildText, category: 'community', topic: 'Główne miejsce rozmów. Szanuj inne dusze.' },
  { key: 'bot', name: '⚙・boty', type: ChannelType.GuildText, category: 'community', topic: 'Komendy botów i automatyzacje.' },
  { key: 'media', name: '◈・galeria-cieni', type: ChannelType.GuildText, category: 'community', topic: 'Grafiki, klipy, zdjęcia i twórczość społeczności.' },
  { key: 'levels', name: '✦・poziomy-dusz', type: ChannelType.GuildText, category: 'community', topic: 'Awanse, karty poziomów i ranking aktywności.', readonly: true },
  { key: 'rolesPanel', name: '✧・role-widma', type: ChannelType.GuildText, category: 'community', topic: 'Wybierz role społecznościowe przyciskami. Każda rola jest dobrowolna.', readonly: true },
  { key: 'suggestions', name: '☁・propozycje', type: ChannelType.GuildText, category: 'community', topic: 'Pomysły społeczności. Użyj /propozycja, aby dodać sugestię i głosować.', readonly: true },
  { key: 'ticketPanel', name: '✉・sala-szeptow', type: ChannelType.GuildText, category: 'community', topic: 'Potrzebujesz pomocy? Użyj /ticket-panel, aby opublikować panel prywatnych zgłoszeń.', readonly: true },
  { key: 'voiceCreator', name: '†・stwórz-pokój', type: ChannelType.GuildVoice, category: 'portal', topic: 'Wejdź tutaj, aby utworzyć własny kanał głosowy.' },
  { key: 'voice-chat', name: '☾・pogadanki', type: ChannelType.GuildVoice, category: 'voice' },
  { key: 'voice-game', name: '◈・gaming', type: ChannelType.GuildVoice, category: 'voice' },
  { key: 'voice-afk', name: '☁・wieczny-afk', type: ChannelType.GuildVoice, category: 'voice' },
  { key: 'messages', name: '†・logi-wiadomości', type: ChannelType.GuildText, category: 'logs', topic: 'Edycje, usunięcia wiadomości i załączniki. Prywatne dla kadry.' },
  { key: 'moderation', name: '☠・logi-moderacji', type: ChannelType.GuildText, category: 'logs', topic: 'Akcje moderacyjne, ostrzeżenia, timeouty i systemy bota.' },
  { key: 'members', name: '☾・logi-kont', type: ChannelType.GuildText, category: 'logs', topic: 'Wejścia, wyjścia i podstawowe zdarzenia kont.' },
  { key: 'actions', name: '⚖・logi-zmian-i-kar', type: ChannelType.GuildText, category: 'logs', topic: 'Zmiany ról, pseudonimów, audyt i administracyjne korekty.' },
];

const textBotPerms = [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.AttachFiles, P.ReadMessageHistory];
const staffSendPerms = [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.EmbedLinks, P.AttachFiles, P.ManageMessages];

async function findOrCreateRole(guild, spec) {
  const existing = guild.roles.cache.find(item => item.name === spec.name);
  // Never rewrite an existing role: it may be customized or used by other automation.
  if (existing && (!spec.key.startsWith('self:') || (existing.permissions.bitfield === 0n && !existing.managed))) return existing;

  // A role exposed to self-service must have zero permissions. If a role with the
  // intended name is already privileged, create a separate safe role rather than
  // stripping permissions from or exposing the existing role to every member.
  let roleName = spec.name;
  if (existing && spec.key.startsWith('self:')) {
    const base = `${spec.name}・MEMBER`;
    roleName = base;
    let suffix = 2;
    while (true) {
      const collision = guild.roles.cache.find(item => item.name === roleName);
      if (!collision) break;
      if (collision.permissions.bitfield === 0n && !collision.managed) return collision;
      roleName = `${base} ${suffix++}`;
    }
  }
  return guild.roles.create({ name: roleName, color: spec.color, mentionable: false, hoist: ['owner', 'admin'].includes(spec.key), permissions: [], reason: 'Konfiguracja serwera WIDMO' });
}

async function findOrCreateCategory(guild, spec, staffRoleIds, staffUserIds, botId) {
  let category = guild.channels.cache.find(item => item.type === ChannelType.GuildCategory && item.name === spec.name);
  const permissionOverwrites = [];
  if (spec.private) {
    permissionOverwrites.push({ id: guild.id, deny: [P.ViewChannel] });
    for (const id of staffRoleIds) permissionOverwrites.push({ id, allow: staffSendPerms });
    for (const id of staffUserIds) permissionOverwrites.push({ id, allow: staffSendPerms });
    permissionOverwrites.push({ id: botId, allow: textBotPerms });
  }
  if (!category) {
    category = await guild.channels.create({ name: spec.name, type: ChannelType.GuildCategory, permissionOverwrites, reason: 'Układ kanałów WIDMO' });
  } else if (spec.private) {
    // Repair privacy even when a same-named category already exists.
    await category.permissionOverwrites.set(permissionOverwrites, 'Zabezpieczenie Archiwum Cieni WIDMO');
  }
  return category;
}

async function findOrCreateChannel(guild, spec, category, staffRoleIds, staffUserIds, botId) {
  let channel = guild.channels.cache.find(item => item.type === spec.type && item.name === spec.name && item.parentId === category.id);
  const options = { name: spec.name, type: spec.type, parent: category.id, reason: 'Układ kanałów WIDMO' };
  if (spec.topic && spec.type === ChannelType.GuildText) options.topic = spec.topic;
  if (spec.readonly) {
    options.permissionOverwrites = [
      { id: guild.id, allow: [P.ViewChannel, P.ReadMessageHistory], deny: [P.SendMessages, P.CreatePublicThreads, P.CreatePrivateThreads, P.SendMessagesInThreads] },
      ...staffRoleIds.map(id => ({ id, allow: staffSendPerms })),
      ...staffUserIds.map(id => ({ id, allow: staffSendPerms })),
      { id: botId, allow: textBotPerms },
    ];
  }
  if (!channel) {
    channel = await guild.channels.create(options);
  } else {
    if (spec.topic && spec.type === ChannelType.GuildText && channel.topic !== spec.topic) await channel.setTopic(spec.topic, 'Aktualizacja opisu kanału WIDMO');
    if (spec.readonly) await channel.permissionOverwrites.set(options.permissionOverwrites, 'Naprawa uprawnień kanału informacyjnego WIDMO');
  }
  return channel;
}

export async function handleWidmoSetup(interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'widmo-setup') return false;
  const permitted = interaction.memberPermissions?.has(P.Administrator) || isBotOwner(interaction.user.id);
  if (!permitted) {
    await interaction.reply({ content: 'Ta komenda wymaga uprawnienia **Administrator** na Discordzie albo wpisania Twojego ID do `OWNER_IDS`.', flags: MessageFlags.Ephemeral });
    return true;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const guild = interaction.guild;
    const me = await guild.members.fetchMe();
    if (!me.permissions.has(P.ManageChannels) || !me.permissions.has(P.ManageRoles)) throw new Error('Nadaj botowi uprawnienia **Manage Channels** i **Manage Roles**, a następnie uruchom `/widmo-setup` ponownie.');
    await guild.roles.fetch();
    await guild.channels.fetch();

    const roleIds = {};
    const levelIds = {};
    const autoIds = [];
    const selfAssignableIds = [];
    const roleLines = [];
    for (const spec of roleSpecs) {
      const role = await findOrCreateRole(guild, spec);
      roleLines.push(`• ${role}`);
      if (spec.key.startsWith('level:')) levelIds[spec.key.split(':')[1]] = role.id;
      else if (spec.key === 'auto') autoIds.push(role.id);
      else if (spec.key.startsWith('self:')) selfAssignableIds.push(role.id);
      else roleIds[spec.key] = role.id;
    }
    config.roles.auto = autoIds;
    config.roles.selfAssignable = selfAssignableIds;
    config.roles.levels = levelIds;
    Object.assign(config.roles, roleIds);
    setSetting(scopedSetting(guild.id, 'roles'), JSON.stringify({ ...roleIds, auto: autoIds, selfAssignable: selfAssignableIds, levels: levelIds }));

    const staffRoleIds = [roleIds.owner, roleIds.admin, roleIds.helper].filter(Boolean);
    const staffUserIds = new Set([interaction.user.id]);
    for (const id of config.ownerIds) {
      if (staffUserIds.has(id)) continue;
      const member = await guild.members.fetch(id).catch(() => null);
      if (member) staffUserIds.add(id);
    }
    const staffUsers = [...staffUserIds];
    const categories = {};
    for (const spec of categorySpecs) categories[spec.key] = await findOrCreateCategory(guild, spec, staffRoleIds, staffUsers, me.id);
    config.voice.categoryId = categories.voice.id;
    config.tickets.categoryId = categories.tickets.id;
    setSetting(scopedSetting(guild.id, 'voice-category'), categories.voice.id);
    setSetting(scopedSetting(guild.id, 'ticket-category'), categories.tickets.id);

    const channelIds = { ...(config.channels ?? {}) };
    const channelLines = [];
    for (const spec of channelSpecs) {
      const channel = await findOrCreateChannel(guild, spec, categories[spec.category], staffRoleIds, staffUsers, me.id);
      if (spec.category === 'logs') await channel.lockPermissions();
      if (['welcome','rules','voiceCreator','messages','members','moderation','levels','actions','ticketPanel','rolesPanel','suggestions'].includes(spec.key)) channelIds[spec.key] = channel.id;
      channelLines.push(`${spec.type === ChannelType.GuildVoice ? '🔊' : '＃'} ${channel}`);
    }
    Object.assign(config.channels, channelIds);
    setSetting(scopedSetting(guild.id, 'channels'), JSON.stringify(channelIds));

    const report = embed('𖤐 WIDMO • Krypta została otwarta',
      'Układ serwera jest gotowy. Kategorie oraz role tworzę tylko wtedy, gdy ich odpowiedniki nie istnieją — ponowne uruchomienie nie powinno robić duplikatów.\n\n' +
      '**Następne kroki**\n' +
      '1. Uruchom `/regulamin`, aby opublikować Kodeks Widma.\n' +
      '2. W kanałach `✧・role-widma` i `✉・sala-szeptow` opublikuj panele komendami `/role-panel` oraz `/ticket-panel`.\n' +
      '3. Otwórz `/konfiguracja` i sprawdź uprawnienia.\n' +
      '4. Przenieś rolę bota nad role WIDMO, które ma nadawać.\n\n' +
      'Nowe role są tworzone bez uprawnień. Istniejące role o tych samych nazwach pozostają nietknięte. Samodzielne role można nadawać panelem; domyślna rola „Nowa Dusza” nie jest hurtowo dodawana obecnym członkom.');
    report.setThumbnail('attachment://widmo-logo.png');
    report.addFields(
      { name: 'Kategorie', value: Object.values(categories).map(c => `• ${c.name}`).join('\n').slice(0, 1000) },
      { name: 'Kanały', value: channelLines.join('\n').slice(0, 1000) },
      { name: 'Role', value: roleLines.join('\n').slice(0, 1000) },
    );
    await interaction.editReply({ embeds: [report], files: [new AttachmentBuilder(path.join(ROOT, 'assets/widmo-logo.png'), { name: 'widmo-logo.png' })], allowedMentions: { parse: [] } });
    console.log(`[WIDMO setup] Skonfigurowano serwer ${guild.id}: ${Object.keys(channelIds).length} mapowanych kanałów, ${roleSpecs.length} ról.`);
  } catch (error) {
    console.error('[WIDMO setup]', error);
    await interaction.editReply({ content: `Nie udało się dokończyć konfiguracji: ${String(error.message ?? error).slice(0, 1500)}\n\nSprawdź uprawnienia bota i uruchom komendę ponownie. Utworzone elementy nie zostaną skasowane; kolejne uruchomienie dokończy konfigurację.`, allowedMentions: { parse: [] } });
  }
  return true;
}
