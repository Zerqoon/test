import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(path.join(root, file), 'utf8');

test('test runner pins test guild and bot owner instead of inheriting live Railway values', () => {
  const runner = read('scripts/test.js');
  const config = read('src/config.js');
  assert.match(runner, /WIDMO_TEST_FIXTURE\s*=\s*'1'/);
  assert.match(runner, /GUILD_ID\s*=\s*'123456789012345678'/);
  assert.match(runner, /OWNER_IDS\s*=\s*'1488470377993736234'/);
  assert.match(config, /config\.guildId\s*=\s*'123456789012345678'/);
  assert.match(config, /config\.ownerIds\s*=\s*\['1488470377993736234'\]/);
});

test('current moderation test contract uses configured Moderator and Owner wording, not removed Helper role', () => {
  const moderationTest = read('test/moderation-extra.test.js');
  const sharedTest = read('test/shared.test.js');
  const config = JSON.parse(read('config.json'));
  assert.equal(Object.hasOwn(config.roles, 'helper'), false);
  assert.match(moderationTest, /config\.roles\.moderator/);
  assert.match(moderationTest, /Admin lub Owner/);
  assert.doesNotMatch(moderationTest, /Admin lub Szef|config\.roles\.helper/);
  assert.match(sharedTest, /config\.roles\.moderator/);
  assert.doesNotMatch(sharedTest, /config\.roles\.helper/);
});

test('AutoMod ticket lookup table is initialized by the central database module', () => {
  const db = read('src/db.js');
  const automod = read('src/automod.js');
  assert.match(db, /CREATE TABLE IF NOT EXISTS widmo_tickets/);
  assert.match(automod, /widmo_tickets WHERE guild_id=\? AND channel_id=\? AND status='open'/);
});


test('AutoMod avoids SQLite bindings when partial message objects do not have a channel ID', () => {
  const automod = read('src/automod.js');
  assert.match(automod, /message\.channelId \?\? message\.channel\?\.id \?\? null/);
  assert.match(automod, /typeof channelId === 'string' && channelId\.length > 0/);
});
