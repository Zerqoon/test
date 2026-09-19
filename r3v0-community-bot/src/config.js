import 'dotenv/config';
import path from 'node:path';

export const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  dataDir: process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || path.join(process.cwd(), 'data'),
  timezone: 'Europe/Warsaw',
  channels: {
    levelUp: '1516768963814490179',
    voiceLobby: '1516765981244915825',
    messageLog: '1517117542223839353',
    voiceLog: '1517117569566507029',
    accountLog: '1517117609617915934',
    changeLog: '1517117642794602516',
  },
  roles: {
    chief: '1515440522225913926',
    bot: '1516499741368647690',
    moderator: '1516499895434088508',
    helper: '1526998317014323221',
    booster: '1515748354426933269',
  },
  levelRoles: [
    { level: 5, id: '1516500127433621504', name: 'Nowicjusz' },
    { level: 10, id: '1516502881115836528', name: 'Adept' },
    { level: 20, id: '1516499892154007562', name: 'Wędrowiec' },
    { level: 30, id: '1516503624946286754', name: 'Strażnik' },
    { level: 40, id: '1516503622337171456', name: 'Czempion' },
    { level: 50, id: '1516503826599903384', name: 'WszechMistrz' },
  ],
  xp: {
    messageChannels: (process.env.XP_CHANNEL_IDS || '').split(',').map(s => s.trim()).filter(Boolean),
    voiceChannels: (process.env.VC_XP_CHANNEL_IDS || '').split(',').map(s => s.trim()).filter(Boolean),
    messageCooldownMs: 45_000,
    repeatCooldownMs: 300_000,
    voiceRequiresTwoPeople: true,
    voiceXpPerMinute: 8,
    boosterRoleMultiplier: 2,
    purchasedMultiplier: 1.5,
  },
};

export function assertConfig({ deployment = false } = {}) {
  const needed = deployment ? ['token', 'clientId', 'guildId'] : ['token', 'guildId'];
  const missing = needed.filter(k => !config[k] || config[k].startsWith?.('WSTAW_'));
  if (missing.length) throw new Error(`Uzupełnij zmienne: ${missing.map(k => ({token:'DISCORD_TOKEN',clientId:'CLIENT_ID',guildId:'GUILD_ID'})[k]).join(', ')}`);
  if (process.env.RAILWAY_PROJECT_ID && !process.env.RAILWAY_VOLUME_MOUNT_PATH) {
    throw new Error('Na Railway dodaj Volume i zamontuj go np. pod /data, aby nie utracić bazy danych.');
  }
}
