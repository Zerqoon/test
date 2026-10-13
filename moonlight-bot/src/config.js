import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadEnvFile } from 'node:process';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(path.join(ROOT, '.env'))) loadEnvFile(path.join(ROOT, '.env'));
const data = JSON.parse(readFileSync(path.join(ROOT, 'config.json'), 'utf8').replace(/^\uFEFF/, ''));
export const config = {
  ...data,
  token: process.env.DISCORD_TOKEN ?? '',
  clientId: process.env.CLIENT_ID ?? '',
  guildId: process.env.GUILD_ID ?? '',
  databasePath: process.env.DATABASE_PATH === ':memory:' ? ':memory:' : path.resolve(ROOT, process.env.DATABASE_PATH || 'data/bot.sqlite'),
};

export function validateConfig({ credentials = true } = {}) {
  const errors = [];
  const snowflake = value => typeof value === 'string' && /^\d{17,20}$/.test(value);
  if (!Array.isArray(config.ownerIds) || !config.ownerIds.length || config.ownerIds.some(id => !snowflake(id))) errors.push('ownerIds musi zawierać ID użytkowników właścicieli bota (w cudzysłowie).');
  if (credentials) {
    if (!config.token || config.token.includes('WKLEJ')) errors.push('Uzupełnij DISCORD_TOKEN w .env.');
    if (!snowflake(config.clientId)) errors.push('Uzupełnij CLIENT_ID (Application ID) w .env.');
    if (!snowflake(config.guildId)) errors.push('Uzupełnij GUILD_ID (ID serwera) w .env.');
  }
  for (const [key, value] of Object.entries(config.channels)) if (!snowflake(value)) errors.push(`Nieprawidłowe ID kanału ${key}.`);
  const roles = [...config.roles.auto, ...Object.values(config.roles.levels), ...['owner','admin','helper','booster','veteran'].map(k => config.roles[k])];
  if (roles.some(id => !snowflake(id))) errors.push('Każde ID roli musi być ciągiem cyfr w cudzysłowie.');
  if (!/^#[\da-f]{6}$/i.test(config.color)) errors.push('Kolor musi mieć format #9676FF.');
  if (!Number.isFinite(config.cards?.backgroundBlur) || config.cards.backgroundBlur < 0 || config.cards.backgroundBlur > 20) errors.push('cards.backgroundBlur musi być liczbą od 0 do 20 (piksele).');
  if (typeof config.serverName !== 'string' || !config.serverName.trim() || config.serverName.length > 80) errors.push('serverName: 1–80 znaków.');
  const positive = [config.xp.messageMin, config.xp.messageMax, config.xp.messageCooldownSeconds, config.xp.minMessageLength, config.xp.voicePerTick, config.xp.voiceIntervalSeconds, config.xp.voiceMinHumans, config.xp.boosterMultiplier, config.logging.retentionDays, config.logging.maxSnapshots, config.voice.createDelayMs, config.voice.maxPerGuild, config.giveaways.maxDurationDays, config.giveaways.maxWinners];
  if (positive.some(n => !Number.isFinite(n) || n <= 0)) errors.push('Ustawienia liczbowe XP, logów, voice i giveaway muszą być dodatnie.');
  if (config.xp.messageMax < config.xp.messageMin) errors.push('messageMax nie może być mniejsze od messageMin.');
  if (![config.xp.messageMin,config.xp.messageMax,config.voice.maxPerGuild,config.logging.maxSnapshots,config.giveaways.maxWinners].every(Number.isInteger)) errors.push('Zakres XP i limity muszą być liczbami całkowitymi.');
  if (!Array.isArray(config.automod.allowedDomains) || !config.automod.allowedDomains.length || config.automod.allowedDomains.some(d => !/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(d))) errors.push('Dozwolone domeny wpisuj jako same nazwy, np. youtube.com.');
  if (errors.length) throw new Error(errors.join('\n'));
  return true;
}
