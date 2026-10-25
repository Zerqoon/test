import { AuditLogEvent, PermissionFlagsBits, escapeMarkdown } from 'discord.js';

const titles = {
  GuildUpdate: 'Zmieniono ustawienia serwera',
  ChannelCreate: 'Utworzono kanał', ChannelUpdate: 'Zmieniono kanał', ChannelDelete: 'Usunięto kanał',
  ChannelOverwriteCreate: 'Dodano uprawnienia kanału', ChannelOverwriteUpdate: 'Zmieniono uprawnienia kanału', ChannelOverwriteDelete: 'Usunięto uprawnienia kanału',
  MemberKick: 'Wyrzucono użytkownika', MemberPrune: 'Usunięto nieaktywne konta', MemberBanAdd: 'Zbanowano użytkownika', MemberBanRemove: 'Odbanowano użytkownika',
  MemberUpdate: 'Zmieniono ustawienia użytkownika', MemberRoleUpdate: 'Zmieniono role użytkownika', MemberMove: 'Przeniesiono użytkowników na voice', MemberDisconnect: 'Odłączono użytkowników od voice', BotAdd: 'Dodano bota',
  RoleCreate: 'Utworzono rolę', RoleUpdate: 'Zmieniono rolę', RoleDelete: 'Usunięto rolę',
  InviteCreate: 'Utworzono zaproszenie', InviteUpdate: 'Zmieniono zaproszenie', InviteDelete: 'Usunięto zaproszenie',
  WebhookCreate: 'Utworzono webhook', WebhookUpdate: 'Zmieniono webhook', WebhookDelete: 'Usunięto webhook',
  EmojiCreate: 'Dodano emoji', EmojiUpdate: 'Zmieniono emoji', EmojiDelete: 'Usunięto emoji',
  MessageDelete: 'Usunięto wiadomości', MessageBulkDelete: 'Zbiorczo usunięto wiadomości', MessagePin: 'Przypięto wiadomość', MessageUnpin: 'Odpięto wiadomość',
  IntegrationCreate: 'Dodano integrację', IntegrationUpdate: 'Zmieniono integrację', IntegrationDelete: 'Usunięto integrację',
  StageInstanceCreate: 'Rozpoczęto scenę', StageInstanceUpdate: 'Zmieniono scenę', StageInstanceDelete: 'Zakończono scenę',
  StickerCreate: 'Dodano naklejkę', StickerUpdate: 'Zmieniono naklejkę', StickerDelete: 'Usunięto naklejkę',
  GuildScheduledEventCreate: 'Utworzono wydarzenie', GuildScheduledEventUpdate: 'Zmieniono wydarzenie', GuildScheduledEventDelete: 'Usunięto wydarzenie',
  ThreadCreate: 'Utworzono wątek', ThreadUpdate: 'Zmieniono wątek', ThreadDelete: 'Usunięto wątek',
  ApplicationCommandPermissionUpdate: 'Zmieniono dostęp do komendy',
  SoundboardSoundCreate: 'Dodano dźwięk', SoundboardSoundUpdate: 'Zmieniono dźwięk', SoundboardSoundDelete: 'Usunięto dźwięk',
  AutoModerationRuleCreate: 'Utworzono regułę automoderacji', AutoModerationRuleUpdate: 'Zmieniono regułę automoderacji', AutoModerationRuleDelete: 'Usunięto regułę automoderacji',
  AutoModerationBlockMessage: 'Automoderacja zablokowała wiadomość', AutoModerationFlagToChannel: 'Automoderacja zgłosiła wiadomość', AutoModerationUserCommunicationDisabled: 'Automoderacja nadała timeout', AutoModerationQuarantineUser: 'Automoderacja ograniczyła konto',
  CreatorMonetizationRequestCreated: 'Złożono wniosek o monetyzację', CreatorMonetizationTermsAccepted: 'Zaakceptowano zasady monetyzacji',
  OnboardingPromptCreate: 'Dodano pytanie powitalne', OnboardingPromptUpdate: 'Zmieniono pytanie powitalne', OnboardingPromptDelete: 'Usunięto pytanie powitalne',
  OnboardingCreate: 'Włączono wprowadzenie na serwer', OnboardingUpdate: 'Zmieniono wprowadzenie na serwer', HomeSettingsCreate: 'Utworzono stronę główną serwera', HomeSettingsUpdate: 'Zmieniono stronę główną serwera',
  VoiceChannelStatusCreate: 'Ustawiono status kanału głosowego', VoiceChannelStatusDelete: 'Usunięto status kanału głosowego',
};
const permissionNames = {
  CreateInstantInvite: 'Tworzenie zaproszeń', KickMembers: 'Wyrzucanie użytkowników', BanMembers: 'Banowanie użytkowników', Administrator: 'Administrator',
  ManageChannels: 'Zarządzanie kanałami', ManageGuild: 'Zarządzanie serwerem', AddReactions: 'Dodawanie reakcji', ViewAuditLog: 'Wyświetlanie dziennika audytu',
  PrioritySpeaker: 'Priorytetowy rozmówca', Stream: 'Transmisje i wideo', ViewChannel: 'Wyświetlanie kanału', SendMessages: 'Wysyłanie wiadomości',
  SendTTSMessages: 'Wiadomości TTS', ManageMessages: 'Zarządzanie wiadomościami', EmbedLinks: 'Osadzanie linków', AttachFiles: 'Załączanie plików',
  ReadMessageHistory: 'Czytanie historii wiadomości', MentionEveryone: 'Wzmianki everyone i here', UseExternalEmojis: 'Zewnętrzne emoji', ViewGuildInsights: 'Statystyki serwera',
  Connect: 'Łączenie z voice', Speak: 'Mówienie na voice', MuteMembers: 'Wyciszanie na voice', DeafenMembers: 'Wyłączanie dźwięku na voice', MoveMembers: 'Przenoszenie na voice', UseVAD: 'Aktywacja głosem',
  ChangeNickname: 'Zmiana własnego pseudonimu', ManageNicknames: 'Zarządzanie pseudonimami', ManageRoles: 'Zarządzanie rolami', ManageWebhooks: 'Zarządzanie webhookami',
  ManageEmojisAndStickers: 'Zarządzanie emoji i naklejkami', ManageGuildExpressions: 'Zarządzanie emoji i naklejkami', UseApplicationCommands: 'Używanie komend aplikacji', RequestToSpeak: 'Prośba o głos',
  ManageEvents: 'Zarządzanie wydarzeniami', ManageThreads: 'Zarządzanie wątkami', CreatePublicThreads: 'Tworzenie publicznych wątków', CreatePrivateThreads: 'Tworzenie prywatnych wątków',
  UseExternalStickers: 'Zewnętrzne naklejki', SendMessagesInThreads: 'Wiadomości w wątkach', UseEmbeddedActivities: 'Uruchamianie aktywności', ModerateMembers: 'Nadawanie timeoutu',
  ViewCreatorMonetizationAnalytics: 'Statystyki monetyzacji', UseSoundboard: 'Używanie panelu dźwięków', CreateGuildExpressions: 'Dodawanie emoji i naklejek', CreateEvents: 'Tworzenie wydarzeń',
  UseExternalSounds: 'Zewnętrzne dźwięki', SendVoiceMessages: 'Wiadomości głosowe', SetVoiceChannelStatus: 'Zmiana statusu voice', SendPolls: 'Tworzenie ankiet', UseExternalApps: 'Zewnętrzne aplikacje',
  PinMessages: 'Przypinanie wiadomości', BypassSlowmode: 'Pomijanie trybu powolnego',
};
const labels = {
  name: 'Nazwa', nick: 'Pseudonim', topic: 'Temat kanału', description: 'Opis', status: 'Status',
  permissions: 'Uprawnienia', allow: 'Zezwolono', deny: 'Zabroniono', permission_overwrites: 'Uprawnienia kanału', permission: 'Dostęp',
  color: 'Kolor roli', colors: 'Kolory roli', primary_color: 'Kolor główny', secondary_color: 'Kolor dodatkowy', tertiary_color: 'Trzeci kolor',
  position: 'Pozycja', hoist: 'Osobna grupa roli', mentionable: 'Możliwość oznaczania roli', managed: 'Rola zarządzana przez integrację',
  nsfw: 'Kanał dla dorosłych', mute: 'Wyciszenie', deaf: 'Wyłączony dźwięk', communication_disabled_until: 'Timeout do',
  rate_limit_per_user: 'Tryb powolny', default_thread_rate_limit_per_user: 'Domyślny tryb powolny wątków', bitrate: 'Jakość dźwięku', user_limit: 'Limit osób',
  type: 'Typ', channel_id: 'Kanał', parent_id: 'Kategoria / kanał nadrzędny', owner_id: 'Właściciel', inviter_id: 'Autor zaproszenia', guild_id: 'Serwer', application_id: 'Aplikacja',
  afk_channel_id: 'Kanał AFK', afk_timeout: 'Czas do AFK', system_channel_id: 'Kanał systemowy', rules_channel_id: 'Kanał regulaminu', public_updates_channel_id: 'Kanał aktualizacji',
  verification_level: 'Poziom weryfikacji', explicit_content_filter: 'Filtr treści', default_message_notifications: 'Powiadomienia', mfa_level: 'Wymagane 2FA',
  preferred_locale: 'Język serwera', vanity_url_code: 'Własny kod zaproszenia', code: 'Kod zaproszenia', max_age: 'Ważność zaproszenia', max_uses: 'Limit użyć', uses: 'Liczba użyć', temporary: 'Tymczasowe członkostwo',
  archived: 'Zarchiwizowany', locked: 'Zablokowany', invitable: 'Możliwość zapraszania do wątku', auto_archive_duration: 'Archiwizacja po', archive_timestamp: 'Data archiwizacji',
  icon_hash: 'Ikona', avatar_hash: 'Awatar', banner_hash: 'Baner', splash_hash: 'Grafika zaproszenia', discovery_splash_hash: 'Grafika odkrywania', image_hash: 'Grafika',
  unicode_emoji: 'Emoji roli', tags: 'Tagi', available: 'Dostępne', enabled: 'Włączone', exempt_roles: 'Wykluczone role', exempt_channels: 'Wykluczone kanały',
  trigger_type: 'Typ reguły', trigger_metadata: 'Warunki reguły', actions: 'Działania reguły', event_type: 'Typ zdarzenia', keyword_filter: 'Filtrowane słowa', regex_patterns: 'Wzorce tekstu',
  allow_list: 'Dozwolone wyrażenia', presets: 'Gotowe filtry', mention_total_limit: 'Limit wzmianek', mention_raid_protection_enabled: 'Ochrona przed masowymi wzmiankami',
  metadata: 'Szczegóły', custom_message: 'Komunikat', duration_seconds: 'Czas ograniczenia', location: 'Miejsce', entity_type: 'Rodzaj wydarzenia', entity_metadata: 'Szczegóły wydarzenia',
  scheduled_start_time: 'Rozpoczęcie wydarzenia', scheduled_end_time: 'Zakończenie wydarzenia', privacy_level: 'Widoczność', rtc_region: 'Region voice', video_quality_mode: 'Jakość wideo',
  id: 'ID', role_id: 'Rola', emoji_id: 'ID emoji', emoji_name: 'Nazwa emoji', volume: 'Głośność',
  channel: 'Kanał', count: 'Liczba', removed: 'Usunięte konta', days: 'Dni nieaktywności', messageId: 'ID wiadomości', applicationId: 'ID aplikacji',
  autoModerationRuleName: 'Reguła automoderacji', autoModerationRuleTriggerType: 'Typ reguły', integrationType: 'Typ integracji',
};
const channelTypes = { 0: 'Tekstowy', 1: 'Prywatna wiadomość', 2: 'Głosowy', 3: 'Rozmowa grupowa', 4: 'Kategoria', 5: 'Ogłoszenia', 10: 'Wątek ogłoszeń', 11: 'Wątek publiczny', 12: 'Wątek prywatny', 13: 'Scena', 14: 'Katalog', 15: 'Forum', 16: 'Media' };
const overwriteEvents = new Set([AuditLogEvent.ChannelOverwriteCreate, AuditLogEvent.ChannelOverwriteUpdate, AuditLogEvent.ChannelOverwriteDelete]);
const boolKeys = new Set(['hoist', 'mentionable', 'managed', 'nsfw', 'mute', 'deaf', 'temporary', 'archived', 'locked', 'invitable', 'available', 'enabled', 'permission', 'mention_raid_protection_enabled']);
const dateKeys = new Set(['communication_disabled_until', 'archive_timestamp', 'scheduled_start_time', 'scheduled_end_time']);
const timeKeys = new Set(['rate_limit_per_user', 'default_thread_rate_limit_per_user', 'afk_timeout', 'max_age', 'duration_seconds']);
const channelKeys = new Set(['channel_id', 'parent_id', 'afk_channel_id', 'system_channel_id', 'rules_channel_id', 'public_updates_channel_id']);
const snowflake = value => typeof value === 'string' && /^\d{15,22}$/.test(value);
const text = value => escapeMarkdown(String(value));
const label = (key, index = 0) => labels[key] ?? `Inna informacja${index ? ` ${index}` : ''}`;

function permissions(value) {
  let bits;
  try { bits = BigInt(value?.bitfield ?? value); } catch { return 'Nie udało się odczytać uprawnień'; }
  if (bits < 0n) return 'Nie udało się odczytać uprawnień';
  if (bits === 0n) return 'Brak';
  const names = new Set(); let known = 0n;
  for (const [key, bit] of Object.entries(PermissionFlagsBits)) {
    if ((bits & bit) === 0n) continue;
    known |= bit;
    names.add(permissionNames[key] ?? 'Dodatkowe uprawnienie Discorda');
  }
  const unknown = bits & ~known;
  if (unknown) names.add(`Inne uprawnienia (maska ${unknown})`);
  return [...names].map(name => `• ${name}`).join('\n');
}

function identity(value, fallbackId, fallbackName = 'Nieznany obiekt') {
  const id = fallbackId ?? value?.id ?? value?.user?.id;
  const name = typeof value === 'string' ? value : value?.tag ?? value?.user?.tag ?? value?.displayName ?? value?.name ?? value?.username ?? value?.code;
  return `${name ? text(name) : fallbackName}${id != null ? `\nID: ${text(id)}` : ''}`;
}

function roleList(value) {
  if (!Array.isArray(value) || !value.length) return 'Brak';
  return value.map(role => {
    if (snowflake(role)) return `• <@&${role}> · ID: ${role}`;
    return `• ${identity(role, null, 'Rola').replaceAll('\n', ' · ')}`;
  }).join('\n');
}

function overwrites(value) {
  const entries = Array.isArray(value) ? value : value?.values ? [...value.values()] : [];
  if (!entries.length) return 'Brak indywidualnych uprawnień';
  return entries.map(item => {
    const name = Number(item.type) === 0 ? 'Rola' : 'Użytkownik';
    const id = item.id ? text(item.id) : 'nieznane';
    return `${name} · ID: ${id}\nZezwolono:\n${permissions(item.allow ?? 0)}\nZabroniono:\n${permissions(item.deny ?? 0)}`;
  }).join('\n\n');
}

function enumValue(value, names) { return names[value] ?? `Inna opcja (${text(value)})`; }

function formatValue(key, value, entry, seen = new Set()) {
  if (value == null) return 'Brak';
  if (['permissions', 'allow', 'deny'].includes(key)) return permissions(value);
  if (key === 'permission_overwrites') return overwrites(value);
  if (key === '$add' || key === '$remove' || key === 'exempt_roles') return roleList(value);
  if (key === 'exempt_channels' && Array.isArray(value)) return value.map(id => snowflake(id) ? `• <#${id}> · ID: ${id}` : `• ${text(id)}`).join('\n') || 'Brak';
  if (dateKeys.has(key)) {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? `<t:${Math.floor(timestamp / 1000)}:F>` : text(value);
  }
  if (typeof value === 'boolean' || (boolKeys.has(key) && [0, 1, '0', '1'].includes(value))) return value === true || value === 1 || value === '1' ? 'Tak' : 'Nie';
  if (key === 'type' && overwriteEvents.has(entry.action)) return enumValue(value, { 0: 'Rola', 1: 'Użytkownik' });
  if (key === 'type' && ['Channel', 'Thread'].includes(entry.targetType)) return enumValue(value, channelTypes);
  if (key === 'verification_level') return enumValue(value, { 0: 'Brak', 1: 'Niski', 2: 'Średni', 3: 'Wysoki', 4: 'Najwyższy' });
  if (key === 'explicit_content_filter') return enumValue(value, { 0: 'Wyłączony', 1: 'Osoby bez ról', 2: 'Wszyscy' });
  if (key === 'default_message_notifications') return enumValue(value, { 0: 'Wszystkie wiadomości', 1: 'Tylko wzmianki' });
  if (key === 'mfa_level') return enumValue(value, { 0: 'Niewymagane', 1: 'Wymagane' });
  if (key === 'video_quality_mode') return enumValue(value, { 1: 'Automatyczna', 2: 'Pełne HD' });
  if (['color', 'primary_color', 'secondary_color', 'tertiary_color'].includes(key) && Number.isInteger(Number(value))) return `#${Number(value).toString(16).padStart(6, '0').toUpperCase()}`;
  if (timeKeys.has(key) && Number.isFinite(Number(value))) return `${value} s`;
  if (key === 'auto_archive_duration' && Number.isFinite(Number(value))) return `${value} min`;
  if (key === 'bitrate' && Number.isFinite(Number(value))) return `${Number(value) / 1000} kb/s`;
  if (channelKeys.has(key) && snowflake(value)) return `<#${value}> · ID: ${value}`;
  if (['owner_id', 'inviter_id'].includes(key) && snowflake(value)) return `<@${value}> · ID: ${value}`;
  if (key === 'channel' && value?.id) return snowflake(value.id) ? `<#${value.id}> · ID: ${value.id}` : identity(value);
  if (typeof value !== 'object') return value === '' ? 'Pusta treść' : text(value);
  if (seen.has(value)) return 'Powiązana informacja';
  seen.add(value);
  let result;
  if (Array.isArray(value)) result = value.map(item => `• ${formatValue('', item, entry, seen)}`).join('\n') || 'Brak';
  else {
    // Unknown structured values stay readable without dumping API objects into Discord.
    const entries = Object.entries(value);
    result = entries.map(([property, item], i) => `${label(property, i + 1)}: ${formatValue(property, item, entry, seen)}`).join('\n') || 'Brak szczegółów';
  }
  seen.delete(value);
  return result;
}

function addField(fields, name, value, inline = false) {
  // Discord counts UTF-16 units. Never split an emoji's surrogate pair.
  let fragment = ''; let part = 1;
  const flush = () => { fields.push({ name: part === 1 ? name : `${name} · ciąg dalszy ${part}`, value: fragment, inline }); fragment = ''; part++; };
  for (const char of value || 'Brak') {
    if (fragment.length + char.length > 1024) flush();
    fragment += char;
  }
  if (fragment) flush();
}

export function auditTitle(entry) {
  return `🛡️ ${titles[AuditLogEvent[entry?.action]] ?? 'Zdarzenie w dzienniku serwera'}`;
}

export function auditFields(entry = {}) {
  const fields = [];
  addField(fields, 'Wykonawca · ID', entry.executorId || entry.executor ? identity(entry.executor, entry.executorId, 'Użytkownik') : 'Discord nie podał wykonawcy');
  const targetLabels = { Guild: 'Serwer', User: 'Użytkownik', Role: 'Rola', Channel: 'Kanał', Thread: 'Wątek', Invite: 'Zaproszenie', Message: 'Wiadomość', Webhook: 'Webhook', Emoji: 'Emoji', Sticker: 'Naklejka', GuildScheduledEvent: 'Wydarzenie', AutoModeration: 'Reguła automoderacji' };
  const targetName = entry.targetType === 'Message' ? (entry.action === AuditLogEvent.MessageBulkDelete ? 'Kanał' : 'Autor wiadomości') : targetLabels[entry.targetType] ?? 'Obiekt';
  const targetFallback = entry.target ?? { name: entry.changes?.find(change => change.key === 'name')?.new ?? entry.changes?.find(change => change.key === 'name')?.old };
  addField(fields, 'Cel · ID', entry.targetId || entry.target ? identity(targetFallback, entry.targetId, targetName) : 'Discord nie podał konkretnego obiektu');
  addField(fields, 'Powód', entry.reason ? text(entry.reason) : 'Nie podano');
  for (const change of entry.changes ?? []) {
    if (!change || typeof change !== 'object') continue;
    const key = change.key;
    if (key === '$add' || key === '$remove') {
      addField(fields, key === '$add' ? 'Nadane role' : 'Odebrane role', roleList(change.new ?? change.old));
      continue;
    }
    const name = snowflake(key) ? `Dostęp do komendy · ID ${key}` : label(key);
    const value = `**Przed:**\n${formatValue(key, change.old, entry)}\n\n**Po:**\n${formatValue(key, change.new, entry)}`;
    addField(fields, name, value);
  }
  const extra = entry.extra;
  if (extra && typeof extra === 'object') {
    if (extra.id) addField(fields, 'Uprawnienia dotyczą', identity(extra, extra.id, Number(extra.type) === 0 ? 'Rola' : 'Użytkownik'));
    else for (const [key, value] of Object.entries(extra)) addField(fields, label(key), formatValue(key, value, entry));
  }
  addField(fields, 'ID audytu', entry.id ? text(entry.id) : 'Brak');
  return fields;
}
