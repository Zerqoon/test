import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from '../src/config.js';
import { welcomeCard, rankCard } from '../src/cards.js';
const member = { displayName: 'Zerqo', user: { username: 'Zerqo' }, guild: { memberCount: 128 }, roles: { cache: new Map() } };
mkdirSync(path.join(ROOT, 'preview'), { recursive: true });
writeFileSync(path.join(ROOT, 'preview/welcome.png'), await welcomeCard(member));
writeFileSync(path.join(ROOT, 'preview/rank.png'), await rankCard(member, { xp: 9570, level: 4, currentXp: 2570, neededXp: 3000, rank: 7 }));
console.log('Zapisano preview/welcome.png i preview/rank.png');
