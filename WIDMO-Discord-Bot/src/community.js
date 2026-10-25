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
import { db, getSetting, setSetting } from './db.js';
import { embed, isBotOwner, replyError, safeText, staffTier } from './shared.js';
import { canOpenAnotherTicket, normalizeTicketType, slugify, suggestionVoteValue, TICKET_TYPES } from './community-helpers.js';
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
    ticket_type TEXT NOT NULL DEFAULT 'general',
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
const ticketColumns = new Set(db.prepare('PRAGMA table_info(widmo_tickets)').all().map(row => row.name));
if (!ticketColumns.has('ticket_type')) db.exec("ALTER TABLE widmo_tickets ADD COLUMN ticket_type TEXT NOT NULL DEFAULT 'general'");

const command = (name, description) => new SlashCommandBuilder()
  .setName(name).setDescription(description).setDMPermission(false);

const ticketPanelCommand = command('ticket-panel', 'Opublikuj panel prywatnych zgłoszeń WIDMO')
  .addChannelOption(o => o.setName('kanal').setDescription('Kanał panelu; domyślnie kanał zgłoszeń WIDMO').addChannelTypes(...textTypes));
const suggestionCommand = command('propozycja', 'Dodaj pomysł i pozwól społeczności zagłosować')
  .addStringOption(o => o.setName('pomysl').setDescription('Co warto zmienić lub dodać?').setMinLength(8).setMaxLength(1200).setRequired(true));
export const communityCommands = [ticketPanelCommand, suggestionCommand];

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
  const card = embed('Centrum pomocy',
    'Wybierz rodzaj zgłoszenia. Bot utworzy prywatny kanał dostępny dla Ciebie i upoważnionego zespołu.\n\n' +
    '**Clan PS99** — sprawy klanowe, rekrutacja i aktywność w grze.\n' +
    '**Pomoc ogólna** — pytania, problemy techniczne i pozostałe sprawy.\n' +
    '**Odbiór nagrody** — odbiór nagród z eventów, giveaway lub konkursów. Przygotuj nazwę nagrody i potwierdzenie wygranej.\n\n' +
    'Opisz jedną sprawę w jednym zgłoszeniu. Nie podawaj haseł ani danych logowania.');
  card.setThumbnail('attachment://widmo-logo.png');
  card.setFooter({ text: 'WIDMO • Centrum pomocy' });
  return {
    embeds: [card], files: [logoFile()], allowedMentions: { parse: [] },
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('widmo:ticket:open:clan').setLabel('Clan PS99').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('widmo:ticket:open:general').setLabel('Pomoc ogólna').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('widmo:ticket:open:reward').setLabel('Odbiór nagrody').setStyle(ButtonStyle.Success),
    )],
  };
}

export async function ensureTicketPanel(client, guildArg = null, channelOverride = null) {
  const guild = guildArg ?? client.guilds.cache.get(config.guildId) ?? await client.guilds.fetch(config.guildId);
  const channelId = channelOverride?.id ?? config.channels.ticketPanel;
  if (!channelId) throw new Error('Nie ustawiono channels.ticketPanel w config.json.');
  const channel = channelOverride ?? await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || channel.guildId !== guild.id || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
    throw new Error('Kanał panelu ticketów nie istnieje, należy do innego serwera lub nie jest tekstowy.');
  }
  const key = `widmo:${guild.id}:ticket-panel:${channel.id}`;
  const stored = getSetting(key);
  let message = null;
  if (stored) {
    try { message = await channel.messages.fetch(stored); }
    catch (error) { if (error?.code !== 10008) throw error; }
  }
  const payload = ticketPanelPayload();
  if (message && message.author.id === client.user.id) {
    await message.edit({ ...payload, attachments: [] });
  } else {
    message = await channel.send(payload);
    setSetting(key, message.id);
  }
  return message;
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
  const card = embed('💡 Sugestia społeczności', safeText(suggestion.content, 1200))
    .addFields(
      { name: 'Zaproponował(a)', value: `<@${suggestion.author_id}>`, inline: true },
      { name: 'Za', value: String(counts.up ?? 0), inline: true },
      { name: 'Przeciw', value: String(counts.down ?? 0), inline: true },
    )
    .setFooter({ text: `WIDMO • Sugestia ${suggestion.id} • można zmienić głos` });
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
    new ButtonBuilder().setCustomId('widmo:ticket:close').setLabel('Zamknij zgłoszenie').setStyle(ButtonStyle.Secondary),
  );
}

async function ticketCategory(guild) {
  const configuredId = config.tickets?.categoryId;
  if (!configuredId) return null;
  const byId = await guild.channels.fetch(configuredId).catch(() => null);
  return byId?.type === ChannelType.GuildCategory ? byId : null;
}

async function existingTickets(guildId, userId) {
  return db.prepare("SELECT * FROM widmo_tickets WHERE guild_id=? AND opener_id=? AND status='open' ORDER BY created_at DESC")
    .all(guildId, userId);
}

function staffOverwrites(guild, openerId, botId) {
  const overwrites = [{ id: guild.id, deny: [P.ViewChannel] }];
  const staffRoleIds = [config.roles.owner, config.roles.admin, config.roles.moderator].filter(Boolean);
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
  const configured = config.channels.actions || config.channels.moderation;
  if (configured) channel = await guild.channels.fetch(configured).catch(() => null);
  if (!channel?.isTextBased?.() || !channel.send) {
    channel = guild.channels.cache.find(ch => ch.type === ChannelType.GuildText && ch.name === 'moderation-logs') ?? null;
  }
  if (!channel?.isTextBased?.() || !channel.send) throw new Error('Nie znaleziono skonfigurowanego kanału logów. Sprawdź ID kanału i uprawnienia bota.');
  const card = embed(title, description);
  if (files.length) return channel.send({ embeds: [card], files, allowedMentions: { parse: [] } });
  return channel.send({ embeds: [card], allowedMentions: { parse: [] } });
}

async function openTicket(interaction, ticketType = 'general') {
  ticketType = normalizeTicketType(ticketType);
  const guild = interaction.guild;
  const actorId = interaction.user.id;
  const lockKey = `${guild.id}:${actorId}`;
  if (ticketOpenLocks.has(lockKey)) {
    await interaction.reply({ content: 'Zgłoszenie jest właśnie przygotowywane. Spróbuj za chwilę.', flags: MessageFlags.Ephemeral });
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
    const category = await ticketCategory(guild);
    if (!category) throw new Error(`Nie znaleziono kategorii ticketów o ID ${config.tickets?.categoryId || '(brak)'}; sprawdź config.json.`);
    const me = await guild.members.fetchMe();
    if (!me.permissions.has(P.ManageChannels) || !me.permissions.has(P.ViewChannel) || !me.permissions.has(P.SendMessages)) {
      throw new Error('Bot potrzebuje uprawnień Manage Channels, View Channel i Send Messages.');
    }
    const base = slugify(interaction.user.username);
    const suffix = randomBytes(2).toString('hex');
    const prefix = TICKET_TYPES[ticketType].prefix;
    channel = await guild.channels.create({
      name: `${prefix}-${base}-${suffix}`,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `Prywatne zgłoszenie WIDMO • autor ID ${actorId} • otwarto ${new Date().toISOString()}`.slice(0, 1024),
      permissionOverwrites: staffOverwrites(guild, actorId, interaction.client.user.id),
      reason: `Prywatne zgłoszenie WIDMO otwarte przez ${interaction.user.tag}`,
    });
    db.prepare('INSERT INTO widmo_tickets(channel_id,guild_id,opener_id,created_at,ticket_type,status) VALUES (?,?,?,?,?,?)')
      .run(channel.id, guild.id, actorId, Date.now(), ticketType, 'open');
    inserted = true;
    const ticketMeta = TICKET_TYPES[ticketType];
    const ticketTitle = ticketMeta.title;
    const ticketDescription = ticketMeta.description;
    const card = embed(ticketTitle,
      `Cześć <@${actorId}>! Zgłoszenie zostało utworzone.\n\n${ticketDescription}\n\n` +
      '**Dalej:**\n' +
      '1. Opisz sprawę konkretnie.\n' +
      '2. W razie potrzeby dołącz dowody lub zrzuty ekranu.\n' +
      '3. Poczekaj na odpowiedź zespołu; nie musisz oznaczać wszystkich.\n\n' +
      'Po zakończeniu skorzystaj z przycisku **Zamknij zgłoszenie**. Bot zapisze transkrypt przed usunięciem kanału.');
    card.setThumbnail('attachment://widmo-logo.png');
    await channel.send({
      content: `<@${actorId}>`, embeds: [card], files: [logoFile()], components: [ticketCloseRow()],
      allowedMentions: { users: [actorId], parse: [] },
    });
    await logTicket(interaction.client, guild, 'Nowe zgłoszenie', `Kanał: ${channel}\nAutor: <@${actorId}> • ID: ${actorId}\nUtworzono: <t:${Math.floor(Date.now() / 1000)}:F>`).catch(error => console.warn('[ticket log open]', error.message));
    await interaction.editReply({ content: `Zgłoszenie zostało otwarte: ${channel}\nKanał widzisz Ty i upoważniony zespół.` });
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
    await interaction.editReply({ content: 'Tylko autor zgłoszenia lub moderator/admin może je zamknąć.' });
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
    await logTicket(interaction.client, interaction.guild, 'Zamknięte zgłoszenie — transkrypt',
      `Kanał: **${safeText(channel.name, 100)}** • ID: ${channel.id}\nAutor: <@${ticket.opener_id}> • ID: ${ticket.opener_id}\nZamknął: <@${interaction.user.id}>\nWiadomości w transkrypcie: **${transcript.length ? 'zapisano' : 'brak'}**`,
      [new AttachmentBuilder(transcript, { name: `widmo-ticket-${channel.id}.txt` })]);
    // Delete only after the transcript is safely archived. Persist final status after
    // deletion so a failed delete can be retried; stale open rows are reconciled next time.
    await channel.delete(`Zgłoszenie WIDMO zamknął ${interaction.user.tag}`);
    db.prepare("UPDATE widmo_tickets SET status='closed', closed_at=?, closed_by=? WHERE channel_id=?")
      .run(Date.now(), interaction.user.id, channelId);
    await interaction.editReply({ content: 'Zgłoszenie zamknięte. Transkrypt zapisano w kanale logów.' });
  } catch (error) {
    console.error('[WIDMO ticket close]', error);
    await interaction.editReply({ content: `Nie zamknąłem zgłoszenia, aby nie utracić transkryptu. Błąd: ${safeText(error.message, 900)}` });
  }
}

async function handlePanelCommand(interaction) {
  if (!isPanelManager(interaction)) throw new Error('Publikowanie panelu wymaga Admina, Ownera lub uprawnienia Manage Server.');
  const target = interaction.options.getChannel('kanal');
  const channel = target ?? (config.channels.ticketPanel ? await interaction.guild.channels.fetch(config.channels.ticketPanel).catch(() => null) : null) ?? interaction.channel;
  if (!channel?.isTextBased?.() || !channel.send || channel.guildId !== interaction.guildId) throw new Error('Wybierz prawidłowy kanał tekstowy na tym serwerze.');
  await ensureTicketPanel(interaction.client, interaction.guild, channel);
  return `Panel ticketów został opublikowany lub zaktualizowany w ${channel}.`;
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
    await interaction.editReply({ content: `Twoja propozycja została opublikowana: ${message.url}` });
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
      await interaction.editReply({ content: result });
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
    if (id === 'widmo:ticket:open' || id.startsWith('widmo:ticket:open:')) {
      const ticketType = id === 'widmo:ticket:open' ? 'general' : id.split(':').at(-1);
      await openTicket(interaction, ticketType);
      return true;
    }
    if (id === 'widmo:ticket:close') {
      const ticket = db.prepare("SELECT * FROM widmo_tickets WHERE channel_id=? AND guild_id=? AND status='open'").get(interaction.channelId, interaction.guildId);
      if (!ticket) {
        await interaction.reply({ content: 'Nie znaleziono aktywnego zgłoszenia w tym kanale.', flags: MessageFlags.Ephemeral });
        return true;
      }
      if (!canCloseTicket(interaction, ticket)) {
        await interaction.reply({ content: 'Tylko autor zgłoszenia lub moderator/admin może je zamknąć.', flags: MessageFlags.Ephemeral });
        return true;
      }
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`widmo:ticket:confirm-close:${ticket.channel_id}`).setLabel('Tak, zamknij').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('widmo:ticket:cancel-close').setLabel('Anuluj').setStyle(ButtonStyle.Secondary),
      );
      await interaction.reply({ content: 'Czy na pewno zamknąć zgłoszenie? Przed usunięciem kanału bot zapisze transkrypt w kanale logów.', components: [row], flags: MessageFlags.Ephemeral });
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
      await interaction.editReply({ content: text });
      return true;
    }
  } catch (error) {
    console.error('[WIDMO community component]', id, error);
    await replyError(interaction, safeText(error.message, 1500)).catch(() => {});
    return true;
  }
  return false;
}

