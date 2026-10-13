import { Client, Events, GatewayIntentBits, Partials, MessageFlags, ActivityType, Options } from 'discord.js';
import { config, validateConfig } from './config.js';
import { db } from './db.js';
import { installLogging } from './logging.js';
import { installMembers } from './members.js';
import { installLevels, handleXpMessage, handleLevelCommand } from './levels.js';
import { enforceMessage } from './automod.js';
import { installVoice, handleVoiceInteraction } from './voice.js';
import { handleCommand, handleCommandComponent, installModeration } from './commands.js';
import { installGiveaways, handleGiveawayCommand, handleGiveawayInteraction } from './giveaways.js';
import { handleDiagnosticCommand, diagnose } from './diagnostics.js';
import { replyError } from './shared.js';

try { validateConfig(); } catch (e) { console.error(`Błąd konfiguracji:\n${e.message}`); process.exit(1); }
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildModeration, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User],
  allowedMentions: { parse: [], repliedUser: false },
  makeCache: Options.cacheWithLimits({ ...Options.DefaultMakeCacheSettings, MessageManager: 100 }),
  sweepers: { ...Options.DefaultSweeperSettings, messages: { interval: 3600, lifetime: 3600 } },
});
const services = [installLogging(client), installMembers(client), installLevels(client), installVoice(client), installGiveaways(client), installModeration(client)];
const event = (name, fn) => client.on(name, (...args) => Promise.resolve().then(() => fn(...args)).catch(e => console.error(`[${name}]`, e)));
const inScope = m => m.guildId === config.guildId && !m.author?.bot && !m.webhookId;
event(Events.MessageCreate, async message => {
  if (!inScope(message)) return;
  if (await enforceMessage(message)) await handleXpMessage(message);
});
event(Events.MessageUpdate, async (_before, message) => {
  if (message.guildId !== config.guildId) return;
  if (message.partial) { try { message = await message.fetch(); } catch { return; } }
  if (inScope(message)) await enforceMessage(message);
});
event(Events.InteractionCreate, async i => {
  if (!i.inGuild() || i.guildId !== config.guildId) {
    if (i.isRepliable()) await i.reply({ content: 'Bot działa tylko na skonfigurowanym serwerze.', flags: MessageFlags.Ephemeral });
    return;
  }
  try {
    // Guild interaction payloads include the actor's current member roles. Administrative
    // mutations also re-fetch after acknowledging; do not delay modal responses with REST.
    if (!i.member?.roles?.cache) i.member = await i.guild.members.fetch(i.user.id);
    if (i.isChatInputCommand()) {
      if (await handleCommand(i) || await handleGiveawayCommand(i) || await handleLevelCommand(i) || await handleDiagnosticCommand(i)) return;
    } else if (i.isMessageComponent() || i.isModalSubmit()) {
      if (await handleVoiceInteraction(i) || await handleGiveawayInteraction(i) || await handleCommandComponent(i)) return;
    }
    if (i.isRepliable()) await replyError(i, 'Ta akcja jest nieaktualna. Użyj /pomoc lub uruchom aktualną komendę.');
  } catch (e) {
    console.error('[interaction]', e);
    await replyError(i, `Nie udało się wykonać akcji: ${e.message || 'nieznany błąd'}`).catch(err => console.error('[interaction reply]', err));
  }
});
client.once(Events.ClientReady, async () => {
  console.log(`Zalogowano jako ${client.user.tag}. Serwer: ${config.guildId}`);
  client.user.setActivity('🌙 /pomoc • nasza społeczność', { type: ActivityType.Watching });
  const guild = await client.guilds.fetch(config.guildId).catch(() => null);
  if (!guild) { console.error('Bot nie jest na wskazanym serwerze. Sprawdź GUILD_ID i zaproszenie OAuth2.'); await shutdown(1); return; }
  try {
    const lines = await diagnose(guild);
    for (const line of lines.filter(l => l.startsWith('❌') || l.startsWith('⚠️'))) console.warn(line);
  } catch (e) { console.error('[diagnostyka startowa]', e); }
});
client.on(Events.Error, e => console.error('[Discord]', e));
client.on(Events.Warn, msg => console.warn('[Discord]', msg));
client.on(Events.ShardDisconnect, event => {
  if (event.code === 4014) console.error('Włącz Server Members Intent i Message Content Intent w Developer Portal.');
});
let closing = false;
async function shutdown(code = 0) {
  if (closing) return; closing = true;
  for (const service of services) { try { await service?.stop?.(); } catch (e) { console.error('[shutdown]', e); } }
  client.destroy();
  try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); db.close(); } catch (e) { console.error('[database close]', e); }
  process.exit(code);
}
process.once('SIGINT', () => shutdown()); process.once('SIGTERM', () => shutdown());
process.on('unhandledRejection', e => console.error('[unhandled promise]', e));
await client.login(config.token).catch(async e => { console.error(`Logowanie nie powiodło się: ${e.message}`); await shutdown(1); });
