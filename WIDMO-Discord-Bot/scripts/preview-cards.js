import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from '../src/config.js';
import { leaderboardCard, levelPanelCard, levelUpCard, rankCard, welcomeCard } from '../src/cards.js';

const now = Date.now();
const mockMember = (displayName, createdOffset = 365, joinedOffset = 30) => ({
  displayName,
  user: {
    username: displayName.toLowerCase().replace(/[^a-z0-9]/g, ''),
    createdAt: new Date(now - createdOffset * 86_400_000),
  },
  joinedAt: new Date(now - joinedOffset * 86_400_000),
  guild: { memberCount: 128 },
  roles: { cache: new Map() },
});
const member = mockMember('Zerqoon', 720, 84);
const stats = { xp: 9570, level: 4, currentXp: 2570, neededXp: 3000, rank: 7, messages: 183 };
mkdirSync(path.join(ROOT, 'preview'), { recursive: true });
writeFileSync(path.join(ROOT, 'preview/welcome.png'), await welcomeCard(member));
writeFileSync(path.join(ROOT, 'preview/rank.png'), await rankCard(member, stats));
writeFileSync(path.join(ROOT, 'preview/level-up.png'), await levelUpCard(member, stats));
writeFileSync(path.join(ROOT, 'preview/level-panel.png'), await levelPanelCard());
const entries = Array.from({ length: 10 }, (_, i) => ({
  userId: String(1000 + i), name: ['Zerqoon','WidmowaDusza','Księżycowy','Nox','Phantom','Cień','Krypta','Duszek','Raven','Night'][i],
  xp: Math.max(100, 25000 - i * 1780), level: Math.max(1, 12 - i), member: i === 0 ? member : null,
}));
writeFileSync(path.join(ROOT, 'preview/leaderboard.png'), await leaderboardCard({ id: 'preview' }, entries));
console.log('Zapisano preview/welcome.png, rank.png, level-up.png, level-panel.png i leaderboard.png');
