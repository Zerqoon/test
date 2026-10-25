import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadEnvFile } from 'node:process';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(path.join(ROOT, '.env'))) loadEnvFile(path.join(ROOT, '.env'));
const data = JSON.parse(readFileSync(path.join(ROOT, 'config.json'), 'utf8').replace(/^\uFEFF/, ''));
export const config = {
  ...data,
  ownerIds: process.env.OWNER_IDS ? process.env.OWNER_IDS.split(',').map(v => v.trim()).filter(Boolean) : (data.ownerIds ?? []),
  token: process.env.DISCORD_TOKEN ?? '',
  clientId: process.env.CLIENT_ID ?? '',
  guildId: process.env.GUILD_ID ?? '',
  databasePath: process.env.DATABASE_PATH === ':memory:' ? ':memory:' : path.resolve(ROOT, process.env.DATABASE_PATH || 'data/bot.sqlite'),
};

// Isolated fixtures are activated only by scripts/test.js; production config never points at old server IDs.
if (process.env.WIDMO_TEST_FIXTURE === '1') {
  Object.assign(config.channels, {
    welcome: '1559306598927704135', voiceCreator: '1516765981244915825',
    messages: '1517117542223839353', members: '1517117609617915934',
    moderation: '1517117609617915934', levels: '1559306736433766500',
    rules: '1515442667750948914', actions: '1517117609617915934',
  });
  Object.assign(config.roles, {
    auto: ['1517118754037698631', '1516502263944839359', '1516502180759212112'],
    owner: '1515440522225913926', admin: '1516499895434088508', helper: '1526998317014323221',
    booster: '1515748354426933269', veteran: '1517165022151704626',
    levels: { '5':'1516500127433621504', '10':'1516502881115836528', '20':'1516499892154007562', '30':'1516503624946286754', '40':'1516503622337171456', '50':'1516503826599903384' },
  });
}

export function validateConfig({ credentials = true } = {}) {
  const errors = [];
  const snowflake = value => typeof value === 'string' && /^\d{17,20}$/.test(value);
  if (!Array.isArray(config.ownerIds) || config.ownerIds.some(id => !snowflake(id))) errors.push('OWNER_IDS/config.ownerIds musi zawierać poprawne ID użytkowników, oddzielone przecinkami. Możesz też pozostawić puste i używać uprawnień Administratora Discorda.');
  if (credentials) {
    if (!config.token || config.token.includes('WKLEJ')) errors.push('Uzupełnij DISCORD_TOKEN w .env.');
    if (!snowflake(config.clientId)) errors.push('Uzupełnij CLIENT_ID (Application ID) w .env.');
    if (!snowflake(config.guildId)) errors.push('Uzupełnij GUILD_ID (ID serwera) w .env.');
  }
  for (const [key, value] of Object.entries(config.channels)) if (value && !snowflake(value)) errors.push(`Nieprawidłowe ID kanału ${key}.`);
  if (config.voice.categoryId && !snowflake(config.voice.categoryId)) errors.push('Nieprawidłowe ID kategorii kanałów głosowych.');
  const roles = [...(config.roles.auto ?? []), ...(config.roles.selfAssignable ?? []), ...Object.values(config.roles.levels ?? {}), ...['owner','admin','helper','booster','veteran'].map(k => config.roles[k]).filter(Boolean)];
  if (roles.some(id => !snowflake(id))) errors.push('Każde skonfigurowane ID roli musi być ciągiem cyfr.');
  if (!/^#[\da-f]{6}$/i.test(config.color)) errors.push('Kolor musi mieć format HEX, np. #F2F2F2.');
  if (!Number.isFinite(config.cards?.backgroundBlur) || config.cards.backgroundBlur < 0 || config.cards.backgroundBlur > 20) errors.push('cards.backgroundBlur musi być liczbą od 0 do 20 (piksele).');
  if (typeof config.serverName !== 'string' || !config.serverName.trim() || config.serverName.length > 80) errors.push('serverName: 1–80 znaków.');
  const positive = [config.xp.messageMin, config.xp.messageMax, config.xp.messageCooldownSeconds, config.xp.minMessageLength, config.xp.voicePerTick, config.xp.voiceIntervalSeconds, config.xp.voiceMinHumans, config.xp.boosterMultiplier, config.logging.retentionDays, config.logging.maxSnapshots, config.voice.createDelayMs, config.voice.maxPerGuild, config.giveaways.maxDurationDays, config.giveaways.maxWinners, config.tickets?.maxOpenPerUser, config.tickets?.transcriptLimit];
  if (positive.some(n => !Number.isFinite(n) || n <= 0)) errors.push('Ustawienia liczbowe XP, logów, voice i giveaway muszą być dodatnie.');
  if (config.xp.messageMax < config.xp.messageMin) errors.push('messageMax nie może być mniejsze od messageMin.');
  if (config.tickets?.categoryId && !snowflake(config.tickets.categoryId)) errors.push('Nieprawidłowe ID kategorii ticketów.');
  if (!Number.isInteger(config.tickets?.maxOpenPerUser) || config.tickets.maxOpenPerUser < 1 || config.tickets.maxOpenPerUser > 3) errors.push('tickets.maxOpenPerUser musi wynosić 1–3.');
  if (!Number.isInteger(config.tickets?.transcriptLimit) || config.tickets.transcriptLimit < 50 || config.tickets.transcriptLimit > 2000) errors.push('tickets.transcriptLimit musi wynosić 50–2000.');
  if (![config.xp.messageMin,config.xp.messageMax,config.voice.maxPerGuild,config.logging.maxSnapshots,config.giveaways.maxWinners].every(Number.isInteger)) errors.push('Zakres XP i limity muszą być liczbami całkowitymi.');
  if (!Array.isArray(config.automod.allowedDomains) || !config.automod.allowedDomains.length || config.automod.allowedDomains.some(d => !/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(d))) errors.push('Dozwolone domeny wpisuj jako same nazwy, np. youtube.com.');
  if (errors.length) throw new Error(errors.join('\n'));
  return true;
}
