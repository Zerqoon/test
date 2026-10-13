import { REST, Routes } from 'discord.js';
import { config, validateConfig } from '../src/config.js';
import { allCommands } from '../src/command-registry.js';
import { db } from '../src/db.js';
try {
  validateConfig();
  const body = allCommands.map(c => c.toJSON());
  if (new Set(body.map(c => c.name)).size !== body.length) throw new Error('Powtórzone nazwy komend.');
  await new REST({ version: '10' }).setToken(config.token).put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body });
  console.log(`Zarejestrowano ${body.length} komend na serwerze ${config.guildId}.`);
} catch (e) { console.error(`Nie udało się zarejestrować komend: ${e.message}`); process.exitCode = 1; }
finally { db.close(); }
