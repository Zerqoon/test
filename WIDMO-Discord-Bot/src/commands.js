import { randomBytes } from 'node:crypto';
import path from 'node:path';
import {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType, MessageFlags,
  ModalBuilder, PermissionFlagsBits, SlashCommandBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { config, ROOT } from './config.js';
import { db } from './db.js';
import { embed, staffTier, isBotOwner, canModerate, parseDuration, replyError, safeText } from './shared.js';
import { logEvent } from './logging.js';
import { banReason, isManagedBan } from './giveaway-utils.js';

const EPHEMERAL = MessageFlags.Ephemeral;
const DAY = 86_400_000;
const activeBans = new Set();
const publishLocks = new Set();
db.exec(`
  CREATE TABLE IF NOT EXISTS timed_bans (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, marker TEXT NOT NULL,
    expires_at INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'pending',
    last_error TEXT, PRIMARY KEY(guild_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS embed_drafts (
    id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, user_id TEXT NOT NULL, channel_id TEXT NOT NULL,
    payload TEXT, expires_at INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'draft', message_id TEXT
  );
`);

const command = (name, description) => new SlashCommandBuilder().setName(name).setDescription(description).setDMPermission(false);
const targetOption = option => option.setName('osoba').setDescription('Użytkownik').setRequired(true);
const reasonOption = option => option.setName('powod').setDescription('Powód działania').setMaxLength(350).setRequired(true);
const idOption = option => option.setName('id').setDescription('ID użytkownika Discord').setMinLength(17).setMaxLength(20).setRequired(true);
const publishChannel = option => option.setName('kanal').setDescription('Kanał publikacji (domyślnie ten kanał)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);
export const commands = [
  command('mute', 'Nadaj timeout (Helper i wyżej)').addUserOption(targetOption)
    .addStringOption(option => option.setName('czas').setDescription('Np. 10m, 2h, 7d; maksymalnie 28 dni').setRequired(true)).addStringOption(reasonOption),
  command('unmute', 'Zdejmij timeout (Helper i wyżej)').addUserOption(targetOption).addStringOption(reasonOption),
  command('ban', 'Zbanuj użytkownika na stałe lub na określony czas').addUserOption(targetOption).addStringOption(reasonOption)
    .addStringOption(option => option.setName('czas').setDescription('Np. 1h, 7d; bez wartości = ban stały. Maks. 365 dni.')),
  command('unban', 'Odbanuj użytkownika po ID').addStringOption(idOption).addStringOption(reasonOption),
  command('avatar', 'Pokaż avatar swój lub wskazanej osoby').addUserOption(option => option.setName('osoba').setDescription('Użytkownik')),
  command('embed', 'Utwórz embed w formularzu i zatwierdź podgląd').addChannelOption(publishChannel),
  command('regulamin', 'Opublikuj lub zaktualizuj regulamin na skonfigurowanym kanale'),
  command('pomoc', 'Zobacz dostępne komendy i zasady zdobywania XP'),
];

async function actorFor(interaction, minimum) {
  const actor = await interaction.guild.members.fetch({ user: interaction.user.id, force: true });
  if (staffTier(actor) < minimum) throw new Error(minimum === 1 ? 'Ta komenda wymaga roli Helper, Admin lub Szef.' : 'Ta komenda wymaga roli Admin lub Szef.');
  return actor;
}

async function targetFor(interaction, actor, minimum, permission, requireMember = true) {
  const user = interaction.options.getUser('osoba', true);
  if (user.id === actor.id || user.bot || user.id === interaction.client.user.id || user.id === interaction.guild.ownerId || isBotOwner(user)) {
    throw new Error('Nie możesz użyć tej komendy na sobie, bocie ani właścicielu bota lub serwera.');
  }
  let target;
  try { target = await interaction.guild.members.fetch(user.id); }
  catch (error) { if (error.code !== 10007) throw error; }
  if (requireMember && !target) throw new Error('Ta osoba nie jest na serwerze.');
  if (target && !canModerate(actor, target, minimum)) throw new Error('Ta osoba jest chroniona poziomem uprawnień lub hierarchią ról.');
  const bot = await interaction.guild.members.fetchMe();
  if (!bot.permissions.has(permission)) throw new Error('Bot nie ma wymaganego uprawnienia Discord do tej akcji.');
  if (target && bot.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
    throw new Error('Przenieś rolę bota nad najwyższą rolę tej osoby.');
  }
  return { user, target };
}

async function audit(interaction, title, description) {
  try {
    await logEvent(interaction.client, config.channels.actions || config.channels.moderation, {
      title, description,
      fields: [{ name: 'Moderator', value: `<@${interaction.user.id}> • ${interaction.user.id}` }],
    });
  } catch (error) { console.error('[moderation log]', error); }
}

async function canPublish(channel, actor) {
  if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) throw new Error('Wybierz zwykły kanał tekstowy lub kanał ogłoszeń.');
  const bot = await channel.guild.members.fetchMe();
  const needed = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
  if (!channel.permissionsFor(bot)?.has(needed)) throw new Error('Bot potrzebuje na tym kanale: wyświetlanie, wysyłanie wiadomości i osadzanie linków.');
  if (!isBotOwner(actor) && !channel.permissionsFor(actor)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) throw new Error('Nie możesz publikować na kanale, na którym nie masz uprawnień do pisania.');
}

function textField(id, label, maxLength, style = TextInputStyle.Short, required = false) {
  return new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label).setMaxLength(maxLength).setStyle(style).setRequired(required));
}

export function rulesEmbed() {
  return embed(`☠ Kodeks Widma • ${config.serverName}`, 'Przekraczasz próg WIDMO. Tu każda dusza ma swoje miejsce — pod warunkiem, że szanuje pozostałe.')
    .addFields(
      { name: 'Ⅰ • SZACUNEK DLA DUSZ', value: 'Zero nękania, gróźb, dyskryminacji i ujawniania prywatnych danych. Za awatarem też jest człowiek — zachowuj klasę.' },
      { name: 'Ⅱ • PORZĄDEK W KRYPCIE', value: 'Korzystaj z kanałów zgodnie z ich przeznaczeniem. Bez spamu, floodu, pingowania bez powodu, oszustw i sztucznego nabijania XP.' },
      { name: 'Ⅲ • BEZ MROCZNYCH AKCJI', value: 'Zakazane są treści NSFW, drastyczne i nielegalne, phishing, malware oraz próby wyłudzania kont. Przestrzegaj zasad Discorda.' },
      { name: 'Ⅳ • LINKI I MEDIA', value: 'Obrazki: od 5 poziomu lub z rolą Weteran. Linki: od 10 poziomu lub z rolą Weteran. Zwykłe linki mogą prowadzić wyłącznie do Giphy, Tenor, Roblox, YouTube, TikTok oraz klipów Twitch i Medal. Weteran może wysyłać inne linki. Zaproszenia do serwerów Discord są zawsze zabronione.' },
      { name: 'Ⅴ • PORTALE GŁOSOWE', value: 'Nie przeszkadzaj innym, nie puszczaj głośnych dźwięków i nie nagrywaj bez zgody. Wejdź do portalu tworzenia i po chwili otrzymasz własną kryptę głosową.' },
      { name: 'Ⅵ • POZIOMY I LOSOWANIA', value: 'XP zdobywasz za poprawne wiadomości i aktywność na voice. Nie spamuj i nie używaj dodatkowych kont do nabijania nagród. Booster otrzymuje 1,5× XP. Wymagania giveaway są sprawdzane przy dołączaniu i losowaniu.' },
      { name: 'Ⅶ • STRAŻNICY WIDMA', value: 'Administracja może usuwać treści oraz stosować timeout lub ban odpowiednio do naruszenia. Wyjaśniaj spory spokojnie z administracją i zgłaszaj problemy z dowodami.' },
    ).setFooter({ text: 'WIDMO • Szanuj innych. Chroń prywatność. Zostaw po sobie dobry ślad.' }).setThumbnail('attachment://widmo-logo.png');
}

async function publishRules(interaction, actor) {
  if (!config.channels.rules) throw new Error('Najpierw uruchom /widmo-setup, aby utworzyć kanały WIDMO.');
  const channel = await interaction.guild.channels.fetch(config.channels.rules);
  await canPublish(channel, actor);
  const key = `rules_message:${interaction.guildId}`;
  if (publishLocks.has(key)) throw new Error('Regulamin jest właśnie aktualizowany. Spróbuj za chwilę.');
  publishLocks.add(key);
  try {
    const old = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;
    let message;
    if (old) {
      try { message = await channel.messages.fetch(old); }
      catch (error) { if (error.code !== 10008) throw error; }
      if (message && message.author.id !== interaction.client.user.id) throw new Error('Zapisana wiadomość regulaminu nie należy do bota.');
    }
    const payload = { embeds: [rulesEmbed()], files: [new AttachmentBuilder(path.join(ROOT, 'assets/widmo-logo.png'), { name: 'widmo-logo.png' })], allowedMentions: { parse: [] } };
    message = message ? await message.edit(payload) : await channel.send({ ...payload, nonce: interaction.id, enforceNonce: true });
    db.prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, message.id);
    await interaction.editReply({ content: `☠ Kodeks Widma jest gotowy: ${message.url}` });
  } finally { publishLocks.delete(key); }
}

export async function handleCommand(interaction) {
  if (!interaction.isChatInputCommand() || !commands.some(item => item.name === interaction.commandName)) return false;
  try {
    // Opening a modal must be the first interaction response (within 3 seconds).
    if (interaction.commandName === 'embed') {
      if (staffTier(interaction.member) < 2) throw new Error('Ta komenda wymaga roli Admin lub Szef.');
      const channel = interaction.options.getChannel('kanal') ?? interaction.channel;
      const id = randomBytes(12).toString('hex');
      db.prepare('INSERT INTO embed_drafts(id, guild_id, user_id, channel_id, expires_at) VALUES(?, ?, ?, ?, ?)')
        .run(id, interaction.guildId, interaction.user.id, channel.id, Date.now() + 30 * 60_000);
      const modal = new ModalBuilder().setCustomId(`embed:form:${id}`).setTitle('Nowy embed • podgląd przed publikacją')
        .addComponents(
          textField('title', 'Tytuł', 256, TextInputStyle.Short, true),
          textField('description', 'Treść embeda', 4000, TextInputStyle.Paragraph, true),
          textField('outside', 'Tekst poza embedem (opcjonalny)', 1900, TextInputStyle.Paragraph),
          textField('color', 'Kolor HEX, np. #FFFFFF (opcjonalny)', 7),
        );
      await interaction.showModal(modal);
      return true;
    }
    await interaction.deferReply({ flags: EPHEMERAL });
    if (interaction.commandName === 'avatar') {
      const user = interaction.options.getUser('osoba') ?? interaction.user;
      const url = user.displayAvatarURL({ extension: 'png', size: 1024 });
      await interaction.editReply({ embeds: [embed(`Avatar • ${user.username}`).setImage(url)], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Otwórz avatar').setURL(url))] });
      return true;
    }
    if (interaction.commandName === 'pomoc') {
      await interaction.editReply({ embeds: [embed(`👻 ${config.serverName} • pomoc`)
        .addFields(
          { name: 'Dla każdego', value: '`/avatar`, `/poziom`, `/ranking`, `/ping`, `/botinfo`, `/userinfo`, `/serverinfo`, `/rola-info`, `/uprawnienia`, `/warny` (własne), `/propozycja`, `/pomoc` • Do giveaway dołączasz przyciskiem. Role z panelu możesz włączać i wyłączać kliknięciem.' },
          { name: 'Helper i wyżej', value: '`/mute osoba czas powod` • `/unmute osoba powod` • `/clear ilosc [osoba]` • `/warn osoba powod` • `/warny [osoba]`' },
          { name: 'Admin i Szef', value: '`/ban osoba powod [czas]` • `/unban id powod` • `/kick osoba powod` • `/slowmode sekundy [kanal]` • `/nick osoba powod [nazwa]` • `/unwarn id powod` • `/embed [kanal]` • `/regulamin` • `/giveaway start/koniec/reroll` • `/konfiguracja` • `/powitanie-test` • `/widmo-setup`' },
          { name: 'Panele społeczności (Admin i Szef)', value: '`/ticket-panel [kanal]` publikuje panel prywatnych zgłoszeń • `/role-panel [kanal]` publikuje role dobrowolne. Zamknięcie ticketu najpierw tworzy transkrypt i zapisuje go w prywatnych logach.' },
          { name: 'Zarządzanie XP (Admin i wyżej)', value: '`/xp dodaj`, `/xp usun`, `/xp ustaw` • `/ustaw-poziom osoba poziom powod`. Dopasowują role poziomów; nie zwiększają liczby wiadomości do giveaway.' },
          { name: 'Właściciel bota', value: `Właściciel wskazany po ID ma wszystkie powyższe komendy bez ról. Twoje ID: ${interaction.user.id}. Użyj /uprawnienia, aby sprawdzić rozpoznany dostęp.` },
          { name: 'XP i poziomy', value: `XP za wiadomość nie częściej niż co ${config.xp.messageCooldownSeconds} s; wymagane min. ${config.xp.minMessageLength} znaków. Voice: ${config.xp.voicePerTick} XP co 5 minut, min. ${config.xp.voiceMinHumans} aktywne osoby, bez wyciszenia i AFK. Booster: ×${config.xp.boosterMultiplier}. Panel interaktywny: /panel • karta: /poziom • ranking: /ranking.` },
          { name: 'Własny kanał', value: `Wejdź na <#${config.channels.voiceCreator}> na 5 sekund. Panel sterowania znajdziesz w czacie utworzonego kanału.` },
        )] });
      return true;
    }
    const minimum = ['mute', 'unmute'].includes(interaction.commandName) ? 1 : 2;
    const actor = await actorFor(interaction, minimum);
    if (interaction.commandName === 'regulamin') {
      await publishRules(interaction, actor);
      return true;
    }
    const reason = interaction.options.getString('powod', true);
    if (['mute', 'unmute'].includes(interaction.commandName)) {
      const { user, target } = await targetFor(interaction, actor, 1, PermissionFlagsBits.ModerateMembers);
      if (!target.moderatable) throw new Error('Discord nie pozwala botowi nadać timeoutu tej osobie (np. ma Administratora).');
      const duration = interaction.commandName === 'mute' ? parseDuration(interaction.options.getString('czas', true), { min: 1000, max: 28 * DAY }) : null;
      await target.timeout(duration, banReason(actor.id, reason));
      const title = duration ? '🔇 Nadano timeout' : '🔊 Zdjęto timeout';
      const description = `<@${user.id}> • ID: ${user.id}\nPowód: ${reason}${duration ? `\nKoniec: <t:${Math.floor((Date.now() + duration) / 1000)}:F>` : ''}`;
      await interaction.editReply({ embeds: [embed(title, description)], allowedMentions: { parse: [] } });
      await audit(interaction, title, description);
      return true;
    }
    if (interaction.commandName === 'unban') {
      const id = interaction.options.getString('id', true);
      if (!/^\d{17,20}$/.test(id)) throw new Error('Podaj prawidłowe ID użytkownika Discord.');
      const bot = await interaction.guild.members.fetchMe();
      if (!bot.permissions.has(PermissionFlagsBits.BanMembers)) throw new Error('Bot potrzebuje uprawnienia Banowanie członków.');
      const key = `${interaction.guildId}:${id}`;
      if (activeBans.has(key)) throw new Error('Dla tej osoby trwa inna operacja bana. Spróbuj za chwilę.');
      activeBans.add(key);
      try {
        await interaction.guild.members.unban(id, banReason(actor.id, reason));
        db.prepare('DELETE FROM timed_bans WHERE guild_id = ? AND user_id = ?').run(interaction.guildId, id);
      } finally { activeBans.delete(key); }
      await interaction.editReply({ content: `Odbanowano użytkownika ${id}.`, allowedMentions: { parse: [] } });
      await audit(interaction, '🔓 Cofnięto ban', `Użytkownik: ${id}\nPowód: ${reason}`);
      return true;
    }
    if (interaction.commandName === 'ban') {
      const { user, target } = await targetFor(interaction, actor, 2, PermissionFlagsBits.BanMembers, false);
      if (target && !target.bannable) throw new Error('Discord nie pozwala botowi zbanować tej osoby. Sprawdź hierarchię ról.');
      const durationText = interaction.options.getString('czas');
      const duration = durationText ? parseDuration(durationText, { min: 60_000, max: 365 * DAY }) : null;
      const key = `${interaction.guildId}:${user.id}`;
      if (activeBans.has(key)) throw new Error('Dla tej osoby trwa inna operacja bana. Spróbuj za chwilę.');
      activeBans.add(key);
      const marker = duration ? randomBytes(12).toString('hex') : null;
      try {
        // A second ban must never overwrite the earlier scheduled expiry.
        try {
          await interaction.guild.bans.fetch(user.id);
          throw new Error('Ta osoba ma już bana. Najpierw użyj /unban, jeśli chcesz zmienić karę.');
        } catch (error) { if (error.code !== 10026) throw error; }
        if (duration) db.prepare(`INSERT INTO timed_bans(guild_id, user_id, marker, expires_at, state) VALUES(?, ?, ?, ?, 'pending')
          ON CONFLICT(guild_id, user_id) DO UPDATE SET marker=excluded.marker, expires_at=excluded.expires_at, state='pending', last_error=NULL`)
          .run(interaction.guildId, user.id, marker, Date.now() + duration);
        else db.prepare('DELETE FROM timed_bans WHERE guild_id = ? AND user_id = ?').run(interaction.guildId, user.id);
        await interaction.guild.members.ban(user.id, { reason: banReason(actor.id, reason, marker), deleteMessageSeconds: 0 });
        if (duration) db.prepare("UPDATE timed_bans SET state='active' WHERE guild_id = ? AND user_id = ? AND marker = ?").run(interaction.guildId, user.id, marker);
      } finally { activeBans.delete(key); }
      const description = `<@${user.id}> • ID: ${user.id}\nPowód: ${reason}\nCzas: ${duration ? `do <t:${Math.floor((Date.now() + duration) / 1000)}:F>` : 'na stałe'}`;
      await interaction.editReply({ embeds: [embed('🔨 Nadano ban', description)], allowedMentions: { parse: [] } });
      await audit(interaction, '🔨 Nadano ban', description);
      return true;
    }
  } catch (error) {
    console.error('[command]', interaction.commandName, error);
    await replyError(interaction, safeText(error.code === 10026 ? 'Ten użytkownik nie ma bana.' : error.message, 1500));
  }
  return true;
}

export async function handleCommandComponent(interaction) {
  if (!(interaction.isButton() || interaction.isModalSubmit()) || !interaction.customId.startsWith('embed:')) return false;
  try {
    await interaction.deferReply({ flags: EPHEMERAL });
    const [, action, id] = interaction.customId.split(':');
    let draft = db.prepare('SELECT * FROM embed_drafts WHERE id = ? AND guild_id = ?').get(id, interaction.guildId);
    if (!draft || draft.expires_at < Date.now()) throw new Error('Ten podgląd wygasł. Utwórz nowy za pomocą /embed.');
    if (draft.user_id !== interaction.user.id) throw new Error('Ten formularz należy do innej osoby.');
    const actor = await actorFor(interaction, 2);
    draft = db.prepare('SELECT * FROM embed_drafts WHERE id = ? AND guild_id = ?').get(id, interaction.guildId);
    if (!draft) throw new Error('Tworzenie tego embeda zostało anulowane.');
    if (draft.state === 'published') {
      await interaction.editReply({ content: `Ten embed został już opublikowany: https://discord.com/channels/${draft.guild_id}/${draft.channel_id}/${draft.message_id}` });
      return true;
    }
    if (action === 'cancel') {
      if (publishLocks.has(id)) throw new Error('Publikacja już trwa. Spróbuj za chwilę.');
      db.prepare('DELETE FROM embed_drafts WHERE id = ?').run(id);
      await interaction.editReply({ content: 'Anulowano tworzenie embeda.' });
      return true;
    }
    const channel = await interaction.guild.channels.fetch(draft.channel_id);
    await canPublish(channel, actor);
    if (action === 'form' && interaction.isModalSubmit()) {
      const color = interaction.fields.getTextInputValue('color').trim() || config.color;
      if (!/^#[\da-f]{6}$/i.test(color)) throw new Error('Kolor musi mieć postać #FFFFFF (6 znaków HEX).');
      const title = interaction.fields.getTextInputValue('title').trim();
      const description = interaction.fields.getTextInputValue('description').trim();
      if (!title || !description) throw new Error('Tytuł i treść nie mogą być puste.');
      const payload = { content: interaction.fields.getTextInputValue('outside').trim() || undefined,
        embeds: [embed(title, description, color).toJSON()], allowedMentions: { parse: [] } };
      db.prepare('UPDATE embed_drafts SET payload = ? WHERE id = ?').run(JSON.stringify(payload), id);
      await interaction.editReply({ ...payload, content: `**Podgląd • kanał <#${channel.id}>**${payload.content ? `\n\n${payload.content}` : ''}`, components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`embed:publish:${id}`).setLabel('Opublikuj').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`embed:cancel:${id}`).setLabel('Anuluj').setStyle(ButtonStyle.Secondary),
      )] });
      return true;
    }
    if (action === 'publish' && interaction.isButton()) {
      if (publishLocks.has(id)) throw new Error('Publikacja już trwa. Spróbuj za chwilę.');
      // Re-check after REST awaits: another click may have finished publishing.
      draft = db.prepare('SELECT * FROM embed_drafts WHERE id = ? AND guild_id = ?').get(id, interaction.guildId);
      if (!draft) throw new Error('Tworzenie tego embeda zostało anulowane.');
      if (draft.state === 'published') {
        await interaction.editReply({ content: `Ten embed został już opublikowany: https://discord.com/channels/${draft.guild_id}/${draft.channel_id}/${draft.message_id}` });
        return true;
      }
      if (!draft.payload) throw new Error('Najpierw uzupełnij formularz.');
      publishLocks.add(id);
      try {
        const message = await channel.send({ ...JSON.parse(draft.payload), nonce: id, enforceNonce: true });
        db.prepare("UPDATE embed_drafts SET state = 'published', message_id = ? WHERE id = ?").run(message.id, id);
        await interaction.editReply({ content: `Opublikowano: ${message.url}` });
      } finally { publishLocks.delete(id); }
      return true;
    }
    throw new Error('Nieprawidłowa akcja formularza.');
  } catch (error) {
    console.error('[embed]', error);
    await replyError(interaction, safeText(error.message, 1500));
  }
  return true;
}

export function installModeration(client) {
  let running = false;
  const sweep = async () => {
    if (running || !client.isReady()) return;
    running = true;
    try {
      db.prepare('DELETE FROM embed_drafts WHERE expires_at < ?').run(Date.now());
      const jobs = db.prepare("SELECT * FROM timed_bans WHERE guild_id = ? AND (expires_at <= ? OR state = 'pending')").all(config.guildId, Date.now());
      for (const job of jobs) {
        const key = `${job.guild_id}:${job.user_id}`;
        if (activeBans.has(key)) continue;
        activeBans.add(key);
        try {
          const guild = await client.guilds.fetch(job.guild_id);
          let ban;
          try { ban = await guild.bans.fetch(job.user_id); }
          catch (error) { if (error.code !== 10026) throw error; }
          if (!ban || !isManagedBan(ban.reason, job.marker)) {
            db.prepare('DELETE FROM timed_bans WHERE guild_id = ? AND user_id = ? AND marker = ?').run(job.guild_id, job.user_id, job.marker);
            continue;
          }
          if (job.expires_at > Date.now()) {
            db.prepare("UPDATE timed_bans SET state='active', last_error=NULL WHERE guild_id = ? AND user_id = ? AND marker = ?").run(job.guild_id, job.user_id, job.marker);
            continue;
          }
          await guild.members.unban(job.user_id, 'Minął czas bana nadanego przez bota.');
          db.prepare('DELETE FROM timed_bans WHERE guild_id = ? AND user_id = ? AND marker = ?').run(job.guild_id, job.user_id, job.marker);
          try { await logEvent(client, config.channels.moderation, { title: '⏱️ Ban czasowy zakończony', description: `Automatycznie odbanowano użytkownika ${job.user_id}.` }); }
          catch (error) { console.error('[timed ban log]', error); }
        } catch (error) {
          db.prepare('UPDATE timed_bans SET last_error = ? WHERE guild_id = ? AND user_id = ? AND marker = ?')
            .run(safeText(error.message, 1000), job.guild_id, job.user_id, job.marker);
          console.error('[timed ban retry]', job.user_id, error);
        } finally { activeBans.delete(key); }
      }
    } finally { running = false; }
  };
  const tick = () => sweep().catch(error => console.error('[moderation scheduler]', error));
  const timer = setInterval(tick, 30_000);
  timer.unref();
  tick();
  return { stop() { clearInterval(timer); } };
}
