import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

process.env.DATABASE_PATH = ':memory:';
process.env.GUILD_ID = '123456789012345678';
const { config } = await import('../src/config.js');
const { db } = await import('../src/db.js');
const { getStats, handleXpMessage, installLevels } = await import('../src/levels.js');
config.xp.messageMin = 10;
config.xp.messageMax = 10;

const guildId = config.guildId;
const roleCache = new Map();
const member = { id: '223456789012345678', guild: { id: guildId }, user: { bot: false }, roles: { cache: roleCache } };
function message(id, content, createdTimestamp) {
  return { id, content, createdTimestamp, guild: member.guild, member, author: { id: member.id, bot: false } };
}
async function waitFor(predicate) {
  for (let i = 0; i < 100; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail('Expected asynchronous reconciliation to complete');
}

test('SQLite counts only qualified messages and preserves exactly 1.5× booster XP', async () => {
  await handleXpMessage(message('1', 'Cześć wszystkim na serwerze', 100000));
  assert.equal(getStats(guildId, member.id).xp, 10);
  assert.equal(getStats(guildId, member.id).messages, 1);
  await handleXpMessage(message('1', 'Cześć wszystkim na serwerze', 100000));
  await handleXpMessage(message('2', 'Zbyt szybka druga wiadomość', 159999));
  await handleXpMessage(message('3', 'krótko', 160000));
  assert.equal(getStats(guildId, member.id).messages, 1);
  roleCache.set(config.roles.booster, {});
  config.xp.messageMin = 11;
  config.xp.messageMax = 11;
  await handleXpMessage(message('4', 'Już minęła minuta od poprzedniej wiadomości', 160000));
  assert.equal(getStats(guildId, member.id).xp, 26.5);
  assert.equal(getStats(guildId, member.id).messages, 2);
  const stored = db.prepare('SELECT * FROM level_stats WHERE guild_id=? AND user_id=?').get(guildId, member.id);
  assert.equal(stored.last_message_id, '4');
  assert.equal(stored.last_message_at, 160000);
  assert.equal(stored.last_message_hash.length, 64);
  roleCache.clear();
  config.xp.messageMin = 10;
  config.xp.messageMax = 10;
});

test('crossing a milestone atomically persists XP, message count, role repair and announcement jobs', async () => {
  db.prepare('UPDATE level_stats SET xp=9990 WHERE guild_id=? AND user_id=?').run(guildId, member.id);
  await handleXpMessage(message('5', 'Wiadomość prowadząca do piątego poziomu', 220000));
  const stats = getStats(guildId, member.id);
  assert.equal(stats.xp, 10000);
  assert.equal(stats.level, 5);
  assert.equal(stats.messages, 3);
  assert.ok(db.prepare('SELECT * FROM level_role_jobs WHERE guild_id=? AND user_id=?').get(guildId, member.id));
  assert.equal(db.prepare('SELECT * FROM level_announcements WHERE guild_id=? AND user_id=?').get(guildId, member.id).level, 5);
  db.prepare('DELETE FROM level_announcements WHERE guild_id=?').run(guildId);
});

test('startup repairs cumulative reward roles and retries missing hierarchy permissions without losing jobs', async () => {
  db.prepare('UPDATE level_stats SET xp=32500 WHERE guild_id=? AND user_id=?').run(guildId, member.id); // LV 10
  const five = config.roles.levels['5'];
  const ten = config.roles.levels['10'];
  const configuredRoles = new Map([[five, { editable: true }], [ten, { editable: false }]]);
  const assigned = [];
  member.roles.add = async (id) => { assigned.push(id); roleCache.set(id, {}); };
  const client = new EventEmitter();
  client.isReady = () => true;
  client.guilds = { cache: new Map([[guildId, {
    id: guildId, available: true, channels: { cache: new Map() },
    members: { fetch: async () => member },
    roles: { cache: configuredRoles, fetch: async (id) => configuredRoles.get(id) },
  }]]) };
  const first = installLevels(client);
  await waitFor(() => db.prepare('SELECT attempts FROM level_role_jobs WHERE guild_id=? AND user_id=?').get(guildId, member.id)?.attempts === 1);
  first.stop();
  assert.deepEqual(assigned, [five]);
  const pending = db.prepare('SELECT * FROM level_role_jobs WHERE guild_id=? AND user_id=?').get(guildId, member.id);
  assert.ok(pending.next_attempt > Date.now());
  configuredRoles.get(ten).editable = true;
  db.prepare('UPDATE level_role_jobs SET next_attempt=0 WHERE guild_id=? AND user_id=?').run(guildId, member.id);
  const second = installLevels(client);
  await waitFor(() => !db.prepare('SELECT 1 FROM level_role_jobs WHERE guild_id=? AND user_id=?').get(guildId, member.id));
  second.stop();
  assert.deepEqual(assigned, [five, ten]);
  assert.equal(client.listenerCount('voiceStateUpdate'), 0);
});

test('earned roles wait for Membership Screening and resume after rules are accepted', async () => {
  roleCache.clear();
  member.pending = true;
  const assigned = [];
  member.roles.add = async (id) => { assigned.push(id); roleCache.set(id, {}); };
  const client = new EventEmitter();
  client.isReady = () => true;
  client.guilds = { cache: new Map([[guildId, {
    id: guildId, available: true, channels: { cache: new Map() },
    members: { fetch: async () => member },
    roles: { cache: new Map(Object.values(config.roles.levels).map((id) => [id, { editable: true }])) },
  }]]) };
  const service = installLevels(client);
  await waitFor(() => db.prepare('SELECT next_attempt FROM level_role_jobs WHERE guild_id=? AND user_id=?').get(guildId, member.id)?.next_attempt > Date.now());
  assert.deepEqual(assigned, []);
  member.pending = false;
  client.emit('guildMemberUpdate', { pending: true }, member);
  await waitFor(() => !db.prepare('SELECT 1 FROM level_role_jobs WHERE guild_id=? AND user_id=?').get(guildId, member.id));
  assert.deepEqual(assigned, [config.roles.levels['5'], config.roles.levels['10']]);
  service.stop();
  assert.equal(client.listenerCount('guildMemberUpdate'), 0);
});
