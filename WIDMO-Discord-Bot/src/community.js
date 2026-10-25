import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
  PermissionFlagsBits as P,
  SlashCommandBuilder,
} from 'discord.js';
import { randomBytes } from 'node:crypto';
import { config, ROOT } from './config.js';
import { db } from './db.js';
import { embed, isBotOwner, replyError, safeText, staffTier } from './shared.js';
import { canOpenAnotherTicket, slugify, suggestionVoteValue } from './community-helpers.js';
import path from 'node:path';

const textTypes = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
const ticketOpenLocks = new Set();

// Durable state is stored on the Railway volume alongside XP and moderation data.
db.exec(`
  CREATE TABLE IF NOT EXISTS widmo_tickets (
    channel_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    opener_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    closed_at INTEGER,
    closed_by TEXT,
    status TEXT NOT NULL DEFAULT 'open'
  );
  CREATE INDEX IF NOT EXISTS widmo_tickets_active ON widmo_tickets(guild_id, opener_id, status);
  CREATE TABLE IF NOT EXISTS widmo_suggestions (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT,
    author_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS widmo_suggestion_votes (
    suggestion_id TEXT NOT NULL REFERENCES widmo_suggestions(id) ON DELETE CASCADE,
    voter_id TEXT NOT NULL,
    vote INTEGER NOT NULL CHECK(vote IN (-1, 1)),
    updated_at INTEGER NOT NULL,
    PRIMARY KEY(suggestion_id, voter_id)
  );
`);

const command = (name, description) => new SlashCommandBuilder()
  .setName(name).setDescription(description).setDMPermission(false);

const ticketPanelCommand = command('ticket-panel', 'Opublikuj panel prywatnych zgłoszeń WIDMO')
  .addChannelOption(o => o.setName('kanal').setDescription('Kanał panelu; domyślnie kanał zgłoszeń WIDMO').addChannelTypes(...textTypes));
const rolePanelCommand = command('role-panel', 'Opublikuj panel dobrowolnych ról społecznościowych')
  .addChannelOption(o => o.setName('kanal').setDescription('Kanał panelu; domyślnie kanał ról WIDMO').addChannelTypes(...textTypes));
const suggestionCommand = command('propozycja', 'Dodaj pomysł i pozwól społeczności zagłosować')
  .addStringOption(o => o.setName('pomysl').setDescription('Co warto zmienić lub dodać?').setMinLength(8).setMaxLength(1200).setRequired(true));
export const communityCommands = [ticketPanelCommand, rolePanelCommand, suggestionCommand];

function isPanelManager(interaction) {
  return Boolean(
    interaction.memberPermissions?.has(P.ManageGuild)
    || interaction.memberPermissions?.has(P.Administrator)
    || isBotOwner(interaction.user.id)
    || staffTier(interaction.member) >= 2,
  );
}

function logoFile() {
  return new AttachmentBuilder(path.join(ROOT, 'assets', 'widmo-logo.png'), { name: 'widmo-logo.png' });
}

function ticketPanelPayload() {
  const card = embed('✉・SALA SZEPTÓW',
    'Nie musisz wołać na cały serwer. Otwórz prywatne zgłoszenie, opisz sprawę spokojnie i poczekaj na odpowiedź zespołu.\n\n' +
    '𖤐 **Jak to działa?**\n' +
    '・Zgłoszenie widzisz tylko Ty i upoważniona kadra.\n' +
    '・Nie otwieraj kilku zgłoszeń w tej samej sprawie.\n' +
    '・Po zakończeniu rozmowy transkrypt trafia do prywatnego archiwum.');
  card.setThumbnail('attachment://widmo-logo.png');
  card.setFooter({ text: 'WIDMO • Każda sprawa zasługuje na spokojną odpowiedź' });
  return {
    embeds: [card], files: [logoFile()], allowedMentions: { parse: [] },
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('widmo:ticket:open').setLabel('Otwórz prywatne zgłoszenie').setEmoji('✉').setStyle(ButtonStyle.Secondary),
    )],
  };
}

function rolePanelPayload(guild) {
  const roleIds = [...new Set(config.roles.selfAssignable ?? [])];
  const roles = roleIds.map(id => guild.roles.cache.get(id)).filter(role => role && !role.managed && role.permissions.bitfield === 0n);
  if (!roles.length) throw new Error('Nie znaleziono ról do wyboru. Uruchom najpierw `/widmo-setup`.');
  const rows = [];
  for (let i = 0; i < roles.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(roles.slice(i, i + 5).map(role =>
      new ButtonBuilder().setCustomId(`widmo:role:${role.id}`).setLabel(safeText(role.name, 80)).setStyle(ButtonStyle.Secondary),
    )));
  }
  const card = embed('✧・WYBIERZ SWÓJ ZNAK',
    'To Ty decydujesz, które oznaczenia chcesz mieć przy swoim imieniu. Kliknij rolę, aby ją otrzymać; ponowne kliknięcie ją zdejmie.\n\n' +
    'Role są dobrowolne i możesz je zmieniać w każdej chwili. Nie wpływają na uprawnienia administracyjne.');
  card.setThumbnail('attachment://widmo-logo.png');
  return { embeds: [card], files: [logoFile()], components: rows, allowedMentions: { parse: [] } };
}

function suggestionCounts(id) {
  return db.prepare(`SELECT
    SUM(CASE WHEN vote=1 THEN 1 ELSE 0 END) AS up,
    SUM(CASE WHEN vote=-1 THEN 1 ELSE 0 END) AS down,
    COUNT(*) AS total
    FROM widmo_suggestion_votes WHERE suggestion_id=?`).get(id) ?? { up: 0, down: 0, total: 0 };
}

function suggestionPayload(suggestion) {
  const counts = suggestionCounts(suggestion.id);
  const card = embed('☁・GŁOS SPOŁECZNOŚCI', safeText(suggestion.content, 1200))
    .addFields(
      { name: 'Zaproponował(a)', value: `<@${suggestion.author_id}>`, inline: true },
      { name: '𖤐 Za', value: String(counts.up ?? 0), inline: true },
      { name: '† Przeciw', value: String(counts.down ?? 0), inline: true },
    )
    .setFooter({ text: `WIDMO • ID propozycji ${suggestion.id} • głos można zmienić` });
  return {
    embeds: [card], allowedMentions: { parse: [], users: [] },
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`widmo:suggestion:vote:${suggestion.id}:up`).setLabel(`Popieram (${counts.up ?? 0})`).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`widmo:suggestion:vote:${suggestion.id}:down`).setLabel(`Nie popieram (${counts.down ?? 0})`).setStyle(ButtonStyle.Secondary),
    )],
  };
}

function ticketCloseRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('widmo:ticket:close').setLabel('Zamknij zgłoszenie').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
  );
}

function ticketCategory(guild) {
  const configuredId = config.tickets?.categoryId;
  const byId = configuredId ? guild.channels.cache.get(configuredId) : null;
  if (byId?.type === ChannelType.GuildCategory) return byId;
  return guild.channels.cache.find(ch => ch.type === ChannelType.GuildCategory && ch.name === '☠・SALA SZEPTÓW') ?? null;
}

async function existingTickets(guildId, userId) {
  return db.prepare("SELECT * FROM widmo_tickets WHERE guild_id=? AND opener_id=? AND status='open' ORDER BY created_at DESC")
    .all(guildId, userId);
}

function staffOverwrites(guild, openerId, botId) {
  const overwrites = [{ id: guild.id, deny: [P.ViewChannel] }];
  const staffRoleIds = [config.roles.owner, config.roles.admin, config.roles.helper].filter(Boolean);
  for (const id of new Set(staffRoleIds)) {
    overwrites.push({ id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.EmbedLinks, P.AttachFiles] });
  }
  const staffUsers = new Set([guild.ownerId, ...config.ownerIds].filter(Boolean));
  for (const id of staffUsers) {
    if (id !== openerId && id !== botId) overwrites.push({ id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.EmbedLinks, P.AttachFiles] });
  }
  overwrites.push({ id: openerId, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.EmbedLinks, P.AttachFiles] });
  overwrites.push({ id: botId, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.EmbedLinks, P.AttachFiles, P.ManageChannels] });
  return overwrites;
}

async function logTicket(client, guild, title, description, files = []) {
  let channel = null;
  const configured = config.channels.moderation || config.channels.actions;
  if (configured) channel = await guild.channels.fetch(configured).catch(() => null);
  if (!channel?.isTextBased?.() || !channel.send) {
    channel = guild.channels.cache.find(ch => ch.type === ChannelType.GuildText && ch.name === '☠・logi-moderacji') ?? null;
  }
  if (!channel?.isTextBased?.() || !channel.send) throw new Error('Nie znaleziono prywatnego kanału logów moderacji. Uruchom `/widmo-setup` i sprawdź uprawnienia.');
  const card = embed(title, description);
  if (files.length) return channel.send({ embeds: [card], files, allowedMentions: { parse: [] } });
  return channel.send({ embeds: [card], allowedMentions: { parse: [] } });
}

async function openTicket(interaction) {
  const guild = interaction.guild;
  const actorId = interaction.user.id;
  const lockKey = `${guild.id}:${actorId}`;
  if (ticketOpenLocks.has(lockKey)) {
    await interaction.reply({ content: '𖤐 Twoje zgłoszenie jest właśnie przygotowywane. Daj mu chwilę.', flags: MessageFlags.Ephemeral });
    return;
  }
  ticketOpenLocks.add(lockKey);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  let channel;
  let inserted = false;
  try {
    const active = await existingTickets(guild.id, actorId);
    const maxOpen = config.tickets?.maxOpenPerUser ?? 1;
    if (!canOpenAnotherTicket(active.length, maxOpen)) {
      let existingChannel = null;
      for (const item of active) {
        existingChannel = await guild.channels.fetch(item.channel_id).catch(() => null);
        if (existingChannel) break;
        db.prepare("UPDATE widmo_tickets SET status='closed', closed_at=?, closed_by=? WHERE channel_id=?")
          .run(Date.now(), 'system:missing-channel', item.channel_id);
      }
      if (existingChannel) {
        await interaction.editReply({ content: `Masz już otwarte zgłoszenie: ${existingChannel}. Wróć do niego, aby nie gubić kontekstu.` });
        return;
      }
    }
    const category = ticketCategory(guild);
    if (!category) throw new Error('Brakuje kategorii `☠・SALA SZEPTÓW`. Najpierw uruchom `/widmo-setup`.');
    const me = await guild.members.fetchMe();
    if (!me.permissions.has(P.ManageChannels) || !me.permissions.has(P.ViewChannel) || !me.permissions.has(P.SendMessages)) {
      throw new Error('Bot potrzebuje uprawnień Manage Channels, View Channel i Send Messages.');
    }
    const base = slugify(interaction.user.username);
    const suffix = randomBytes(2).toString('hex');
    channel = await guild.channels.create({
      name: `sprawa-${base}-${suffix}`,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `Prywatne zgłoszenie WIDMO • autor ID ${actorId} • otwarto ${new Date().toISOString()}`.slice(0, 1024),
      permissionOverwrites: staffOverwrites(guild, actorId, interaction.client.user.id),
      reason: `Prywatne zgłoszenie WIDMO otwarte przez ${interaction.user.tag}`,
    });
    db.prepare('INSERT INTO widmo_tickets(channel_id,guild_id,opener_id,created_at,status) VALUES (?,?,?,?,?)')
      .run(channel.id, guild.id, actorId, Date.now(), 'open');
    inserted = true;
    const card = embed('✉・ZGŁOSZENIE OTWARTE',
      `Witaj <@${actorId}>. To prywatna przestrzeń do wyjaśnienia sprawy.\n\n` +
      '**Żeby pomóc szybciej:**\n' +
      '1. Opisz, co się wydarzyło.\n' +
      '2. Dodaj dowody lub zrzuty ekranu, jeśli są potrzebne.\n' +
      '3. Poczekaj na odpowiedź kadry — nie musisz oznaczać wszystkich.\n\n' +
      'Po zakończeniu rozmowy wybierz **Zamknij zgłoszenie**. Transkrypt zostanie zapisany w prywatnym archiwum.');
    card.setThumbnail('attachment://widmo-logo.png');
    await channel.send({
      content: `<@${actorId}>`, embeds: [card], files: [logoFile()], components: [ticketCloseRow()],
      allowedMentions: { users: [actorId], parse: [] },
    });
    await logTicket(interaction.client, guild, '✉・Nowe prywatne zgłoszenie', `Kanał: ${channel}\nAutor: <@${actorId}> • ID: ${actorId}\nUtworzono: <t:${Math.floor(Date.now() / 1000)}:F>`).catch(error => console.warn('[ticket log open]', error.message));
    await interaction.editReply({ content: `𖤐 Prywatna sala została otwarta: ${channel}\nOpisz sprawę w kanale. Tylko Ty i upoważniona kadra mają do niego dostęp.` });
  } catch (error) {
    if (inserted && channel) db.prepare("UPDATE widmo_tickets SET status='error', closed_at=?, closed_by=? WHERE channel_id=?").run(Date.now(), 'system:creation-failed', channel.id);
    if (channel) await channel.delete('Sprzątanie nieudanego tworzenia zgłoszenia').catch(() => {});
    console.error('[WIDMO ticket open]', error);
    await interaction.editReply({ content: `Nie udało się otworzyć zgłoszenia: ${safeText(error.message, 1000)}` }).catch(() => {});
  } finally {
    ticketOpenLocks.delete(lockKey);
  }
}

function canCloseTicket(interaction, ticket) {
  return interaction.user.id === ticket.opener_id || isBotOwner(interaction.user.id)
    || staffTier(interaction.member) >= 1
    || Boolean(interaction.memberPermissions?.has(P.ManageChannels) || interaction.memberPermissions?.has(P.Administrator));
}

async function collectTranscript(channel, limit = 500) {
  const messages = [];
  let before;
  const cap = Math.min(Math.max(limit, 50), 2000);
  const pages = Math.ceil(cap / 100);
  for (let page = 0; page < pages && messages.length < cap; page += 1) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    if (!batch.size) break;
    const chunk = [...batch.values()];
    messages.push(...chunk.slice(0, Math.max(0, cap - messages.length)));
    before = chunk[chunk.length - 1]?.id;
    if (batch.size < 100) break;
  }
  messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const body = messages.map(message => {
    const author = `${message.author?.tag ?? 'Nieznany użytkownik'} (ID: ${message.author?.id ?? 'brak'})`;
    const stamp = new Date(message.createdTimestamp ?? Date.now()).toISOString();
    const content = message.content?.trim() || '[brak tekstu]';
    const attachments = [...(message.attachments?.values?.() ?? [])].map(a => `${a.name ?? 'załącznik'}: ${a.url}`).join('\n');
    const embeds = [...(message.embeds ?? [])].map(e => [e.title, e.description].filter(Boolean).join('\n')).filter(Boolean).join('\n');
    return `[${stamp}] ${author}\n${content}${attachments ? `\nZałączniki:\n${attachments}` : ''}${embeds ? `\nEmbeds:\n${embeds}` : ''}`;
  }).join('\n\n────────────────────────────────────────\n\n');
  const header = `WIDMO • TRANSKRYPT ZGŁOSZENIA\nKanał: #${channel.name} (${channel.id})\nSerwer ID: ${channel.guildId}\nZebrano wiadomości: ${messages.length}\nWygenerowano: ${new Date().toISOString()}\n\n`;
  return Buffer.from(header + (body || 'Brak zapisanych wiadomości.'), 'utf8');
}

async function confirmCloseTicket(interaction, channelId) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const ticket = db.prepare("SELECT * FROM widmo_tickets WHERE channel_id=? AND guild_id=? AND status='open'").get(channelId, interaction.guildId);
  if (!ticket) {
    await interaction.editReply({ content: 'To zgłoszenie jest już zamknięte albo nie istnieje.' });
    return;
  }
  if (!canCloseTicket(interaction, ticket)) {
    await interaction.editReply({ content: 'Tylko autor zgłoszenia lub kadra może je zamknąć.' });
    return;
  }
  const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.() || !channel.messages?.fetch) {
    db.prepare("UPDATE widmo_tickets SET status='closed', closed_at=?, closed_by=? WHERE channel_id=?")
      .run(Date.now(), interaction.user.id, channelId);
    await interaction.editReply({ content: 'Kanał nie istnieje. Zgłoszenie oznaczono jako zamknięte; transkrypt nie był dostępny.' });
    return;
  }
  try {
    const transcript = await collectTranscript(channel, config.tickets?.transcriptLimit ?? 500);
    await logTicket(interaction.client, interaction.guild, '🔒・Zgłoszenie zamknięte — transkrypt',
      `Kanał: **${safeText(channel.name, 100)}** • ID: ${channel.id}\nAutor: <@${ticket.opener_id}> • ID: ${ticket.opener_id}\nZamknął: <@${interaction.user.id}>\nWiadomości w transkrypcie: **${transcript.length ? 'zapisano' : 'brak'}**`,
      [new AttachmentBuilder(transcript, { name: `widmo-ticket-${channel.id}.txt` })]);
    // Delete only after the transcript is safely archived. Persist final status after
    // deletion so a failed delete can be retried; stale open rows are reconciled next time.
    await channel.delete(`Zgłoszenie WIDMO zamknął ${interaction.user.tag}`);
    db.prepare("UPDATE widmo_tickets SET status='closed', closed_at=?, closed_by=? WHERE channel_id=?")
      .run(Date.now(), interaction.user.id, channelId);
    await interaction.editReply({ content: '𖤐 Zgłoszenie zamknięte. Transkrypt został zapisany w prywatnym Archiwum Cieni.' });
  } catch (error) {
    console.error('[WIDMO ticket close]', error);
    await interaction.editReply({ content: `Nie zamknąłem zgłoszenia, aby nie utracić transkryptu. Błąd: ${safeText(error.message, 900)}` });
  }
}

async function handlePanelCommand(interaction) {
  if (!isPanelManager(interaction)) throw new Error('Ten panel może publikować tylko kadra (Manage Server/Admin) lub właściciel bota.');
  const target = interaction.options.getChannel('kanal');
  let channel = target;
  if (!channel) {
    const id = interaction.commandName === 'ticket-panel' ? config.channels.ticketPanel : config.channels.rolesPanel;
    if (id) channel = await interaction.guild.channels.fetch(id).catch(() => null);
  }
  channel ??= interaction.channel;
  if (!channel?.isTextBased?.() || !channel.send || !channel.guildId) throw new Error('Wybierz prawidłowy kanał tekstowy na tym serwerze.');
  if (interaction.commandName === 'ticket-panel') {
    await channel.send(ticketPanelPayload());
    return `Panel prywatnych zgłoszeń opublikowano w ${channel}.`;
  }
  await interaction.guild.roles.fetch();
  const payload = rolePanelPayload(interaction.guild);
  await channel.send(payload);
  return `Panel dobrowolnych ról opublikowano w ${channel}.`;
}

async function submitSuggestion(interaction) {
  const content = interaction.options.getString('pomysl', true).trim();
  if (content.length < 8) throw new Error('Rozwiń propozycję do co najmniej 8 znaków.');
  let channel = config.channels.suggestions ? await interaction.guild.channels.fetch(config.channels.suggestions).catch(() => null) : null;
  if (!channel?.isTextBased?.() || !channel.send) {
    channel = interaction.guild.channels.cache.find(ch => ch.type === ChannelType.GuildText && ch.name === '☁・propozycje') ?? null;
  }
  if (!channel?.isTextBased?.() || !channel.send) throw new Error('Nie znaleziono kanału propozycji. Uruchom `/widmo-setup`.');
  const id = randomBytes(6).toString('hex');
  db.prepare('INSERT INTO widmo_suggestions(id,guild_id,channel_id,author_id,content,created_at) VALUES (?,?,?,?,?,?)')
    .run(id, interaction.guildId, channel.id, interaction.user.id, content, Date.now());
  const suggestion = db.prepare('SELECT * FROM widmo_suggestions WHERE id=?').get(id);
  try {
    const message = await channel.send(suggestionPayload(suggestion));
    db.prepare('UPDATE widmo_suggestions SET message_id=? WHERE id=?').run(message.id, id);
    await interaction.editReply({ content: `☁ Twoja propozycja została opublikowana: ${message.url}` });
  } catch (error) {
    db.prepare('DELETE FROM widmo_suggestions WHERE id=?').run(id);
    throw error;
  }
}

export async function handleCommunityCommand(interaction) {
  if (!interaction.isChatInputCommand() || !communityCommands.some(c => c.name === interaction.commandName)) return false;
  try {
    if (interaction.commandName === 'propozycja') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await submitSuggestion(interaction);
    } else {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const result = await handlePanelCommand(interaction);
      await interaction.editReply({ content: `𖤐 ${result}` });
    }
  } catch (error) {
    console.error('[WIDMO community command]', interaction.commandName, error);
    await replyError(interaction, safeText(error.message, 1600));
  }
  return true;
}

export async function handleCommunityComponent(interaction) {
  if (!interaction.isMessageComponent() || !interaction.customId?.startsWith('widmo:')) return false;
  const id = interaction.customId;
  try {
    if (id === 'widmo:ticket:open') {
      await openTicket(interaction);
      return true;
    }
    if (id === 'widmo:ticket:close') {
      const ticket = db.prepare("SELECT * FROM widmo_tickets WHERE channel_id=? AND guild_id=? AND status='open'").get(interaction.channelId, interaction.guildId);
      if (!ticket) {
        await interaction.reply({ content: 'Nie znaleziono aktywnego zgłoszenia w tym kanale.', flags: MessageFlags.Ephemeral });
        return true;
      }
      if (!canCloseTicket(interaction, ticket)) {
        await interaction.reply({ content: 'Tylko autor zgłoszenia lub kadra może je zamknąć.', flags: MessageFlags.Ephemeral });
        return true;
      }
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`widmo:ticket:confirm-close:${ticket.channel_id}`).setLabel('Tak, zamknij').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('widmo:ticket:cancel-close').setLabel('Anuluj').setStyle(ButtonStyle.Secondary),
      );
      await interaction.reply({ content: 'Czy na pewno zamknąć zgłoszenie? Przed usunięciem kanału bot zapisze transkrypt w prywatnym Archiwum Cieni.', components: [row], flags: MessageFlags.Ephemeral });
      return true;
    }
    if (id.startsWith('widmo:ticket:confirm-close:')) {
      const channelId = id.split(':').at(-1);
      await confirmCloseTicket(interaction, channelId);
      return true;
    }
    if (id === 'widmo:ticket:cancel-close') {
      await interaction.update({ content: 'Zamknięcie anulowane. Zgłoszenie pozostaje otwarte.', components: [] });
      return true;
    }
    if (id.startsWith('widmo:role:')) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const roleId = id.slice('widmo:role:'.length);
      if (!(config.roles.selfAssignable ?? []).includes(roleId)) throw new Error('Ta rola nie należy do panelu WIDMO. Uruchom /widmo-setup lub poproś kadrę o aktualizację panelu.');
      const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
      if (!role || role.managed || role.id === interaction.guild.id) throw new Error('Ta rola nie jest dostępna do samodzielnego nadania.');
      const botMember = await interaction.guild.members.fetchMe();
      if (!botMember.permissions.has(P.ManageRoles) || botMember.roles.highest.comparePositionTo(role) <= 0) throw new Error('Bot nie może zarządzać tą rolą. Przenieś rolę bota wyżej niż role z panelu.');
      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role, 'Samodzielna zmiana ról WIDMO');
        await interaction.editReply({ content: `Zabrano Ci rolę **${safeText(role.name, 80)}**.` });
      } else {
        await member.roles.add(role, 'Samodzielna zmiana ról WIDMO');
        await interaction.editReply({ content: `Nadano Ci rolę **${safeText(role.name, 80)}**. Możesz ją zdjąć, klikając przycisk ponownie.` });
      }
      return true;
    }
    if (id.startsWith('widmo:suggestion:vote:')) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const [, , , suggestionId, direction] = id.split(':');
      const suggestion = db.prepare('SELECT * FROM widmo_suggestions WHERE id=? AND guild_id=?').get(suggestionId, interaction.guildId);
      if (!suggestion) throw new Error('Ta propozycja nie istnieje lub pochodzi z innego serwera.');
      if (!['up', 'down'].includes(direction)) throw new Error('Nieznany rodzaj głosu.');
      const vote = suggestionVoteValue(direction);
      if (vote === null) throw new Error('Nieznany rodzaj głosu.');
      const previous = db.prepare('SELECT vote FROM widmo_suggestion_votes WHERE suggestion_id=? AND voter_id=?').get(suggestionId, interaction.user.id);
      db.prepare(`INSERT INTO widmo_suggestion_votes(suggestion_id,voter_id,vote,updated_at) VALUES (?,?,?,?)
        ON CONFLICT(suggestion_id,voter_id) DO UPDATE SET vote=excluded.vote, updated_at=excluded.updated_at`)
        .run(suggestionId, interaction.user.id, vote, Date.now());
      await interaction.message.edit(suggestionPayload(suggestion));
      const text = previous?.vote === vote ? 'Twój głos był już zapisany — licznik został odświeżony.' : previous ? 'Zmieniono Twój głos.' : 'Zapisano Twój głos.';
      await interaction.editReply({ content: `☁ ${text}` });
      return true;
    }
  } catch (error) {
    console.error('[WIDMO community component]', id, error);
    await replyError(interaction, safeText(error.message, 1500)).catch(() => {});
    return true;
  }
  return false;
}

