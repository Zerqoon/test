import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => readFileSync(path.join(root, name), 'utf8');
const config = JSON.parse(read('config.json'));

test('WIDMO server channel IDs and ticket category match the configured server', () => {
  assert.equal(config.channels.welcome, '1559306598927704135');
  assert.equal(config.channels.rules, '1515442667750948914');
  assert.equal(config.channels.levels, '1559306736433766500');
  assert.equal(config.channels.voiceCreator, '1516765981244915825');
  assert.equal(config.channels.ticketPanel, '1563956514417414315');
  assert.equal(config.channels.suggestions, '1563957007126626384');
  assert.equal(config.tickets.categoryId, '1563987770391924777');
});

test('only supplied staff roles are configured; owner access is user-ID based', () => {
  assert.equal(config.roles.owner, '1515440522225913926');
  assert.equal(config.roles.admin, '1563993794536284190');
  assert.equal(config.roles.booster, '1515748354426933269');
  assert.equal(config.roles.veteran, '1517165022151704626');
  assert.equal(config.roles.moderator, '1516499895434088508');
  assert.deepEqual(config.ownerIds, ['1488470377993736234']);
  assert.equal(Object.hasOwn(config.roles, 'helper'), false);
  assert.equal(config.roles.selfAssignable.length, 0);
});

test('level and ticket panels use plain button labels (no invalid emoji payloads)', () => {
  const levels = read('src/levels.js');
  const community = read('src/community.js');
  assert.doesNotMatch(levels, /\.setEmoji\(/);
  assert.doesNotMatch(community, /\.setEmoji\(/);
  for (const label of ['Moja karta', 'Ranking TOP 10', 'Jak zdobywać XP', 'Nagrody za poziom']) assert.ok(levels.includes(label));
  assert.ok(community.includes("setLabel('Clan PS99')"));
  assert.ok(community.includes("setLabel('Pomoc ogólna')"));
  assert.ok(community.includes("setLabel('Odbiór nagrody')"));
});

test('Canvas explicitly registers Linux fonts and the Docker build has a visible-text smoke test', () => {
  const cards = read('src/cards.js');
  const check = read('scripts/check.js');
  const docker = read('Dockerfile');
  assert.match(cards, /GlobalFonts\.registerFromPath/);
  assert.match(cards, /WIDMO Sans Bold/);
  assert.match(cards, /export async function verifyCanvasRendering/);
  assert.match(cards, /getImageData/);
  assert.match(check, /verifyCanvasRendering/);
  assert.match(docker, /RUN npm run check/);
  assert.match(docker, /RUN npm test/);
});

test('reward roles are configurable with slash commands instead of invented IDs', () => {
  const levels = read('src/levels.js');
  const helpers = read('src/level-reward-helpers.js');
  assert.match(levels, /setName\('nagrody-poziomu'\)/);
  assert.match(levels, /setLevelReward/);
  assert.match(levels, /removeLevelReward/);
  assert.match(helpers, /retiredLevelRoles/);
});

test('ticket permissions explicitly allow uploads and the automatic ticket repair also handles existing tickets', () => {
  const community = read('src/community.js');
  assert.match(community, /AttachFiles:\s*true/);
  assert.match(community, /ensureTicketUploadPermissions\(channel, guild, actorId, interaction\.client\.user\.id\)/);
  assert.match(community, /ensureTicketUploadPermissions\(channel, guild, row\.opener_id, guild\.client\.user\.id\)/);
  assert.match(community, /Możesz wysyłać zdjęcia, zrzuty ekranu i pliki bezpośrednio na tym kanale/);
  const automod = read('src/automod.js');
  assert.match(automod, /widmo_tickets WHERE guild_id=\? AND channel_id=\? AND status='open'/);
  assert.match(automod, /allowAttachments: allowTicketAttachments/);
});
