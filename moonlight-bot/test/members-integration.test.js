import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Events } from 'discord.js';
process.env.DATABASE_PATH = ':memory:';
process.env.GUILD_ID = '123456789012345678';
const { config } = await import('../src/config.js');
const { db } = await import('../src/db.js');
const { installMembers } = await import('../src/members.js');

async function waitFor(check) {
  for (let n = 0; n < 200; n += 1) { if (check()) return; await new Promise(r => setTimeout(r, 5)); }
  assert.fail('Autorole reconciliation did not complete');
}

test('autoroles retry each role independently, survive restart, and never repeat the welcome', async () => {
  const assigned = []; let welcomes = 0; let failSecond = true;
  const guild = { id: config.guildId, available: true, memberCount: 2 };
  const member = { id: '223456789012345678', guild, joinedTimestamp: 1234567, displayName: 'Test', pending: true,
    user: { bot: false, username: 'Test' }, roles: { cache: new Map(), add: async role => {
      if (role.id === config.roles.auto[1] && failSecond) throw new Error('Simulated permission failure');
      assigned.push(role.id); member.roles.cache.set(role.id, role);
    } } };
  guild.members = { fetch: async () => member };
  guild.roles = { fetch: async id => ({ id, editable: true }) };
  const client = new EventEmitter(); client.isReady = () => true;
  client.guilds = { cache: new Map([[guild.id, guild]]) };
  client.channels = { fetch: async () => ({ guildId: guild.id, isTextBased: () => true, send: async () => { welcomes += 1; } }) };
  const job = () => db.prepare('SELECT * FROM autorole_jobs WHERE guild_id=? AND user_id=?').get(guild.id, member.id);
  const first = installMembers(client);
  client.emit(Events.GuildMemberAdd, member);
  await waitFor(() => welcomes === 1 && job()?.next_attempt > Date.now());
  assert.deepEqual(assigned, []);
  member.pending = false;
  client.emit(Events.GuildMemberUpdate, { pending: true }, member);
  await waitFor(() => job()?.attempts === 1);
  assert.deepEqual(assigned, [config.roles.auto[0], config.roles.auto[2]]);
  assert.equal(welcomes, 1);
  first.stop();
  failSecond = false;
  db.prepare('UPDATE autorole_jobs SET next_attempt=0').run();
  const second = installMembers(client);
  await waitFor(() => !job());
  assert.deepEqual(assigned, [config.roles.auto[0], config.roles.auto[2], config.roles.auto[1]]);
  assert.equal(welcomes, 1);
  client.emit(Events.GuildMemberAdd, member);
  await waitFor(() => !job());
  assert.equal(welcomes, 1);
  second.stop();
});

test('saved jobs wait for readiness and discard users who left the guild', async () => {
  const guild = { id: config.guildId, available: true, members: { fetch: async () => { throw Object.assign(new Error('Unknown Member'), { code: 10007 }); } } };
  db.prepare('INSERT INTO autorole_jobs(guild_id,user_id) VALUES(?,?)').run(guild.id, 'gone');
  const client = new EventEmitter(); let ready = false;
  client.isReady = () => ready; client.guilds = { cache: new Map([[guild.id, guild]]) };
  const service = installMembers(client);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM autorole_jobs').get().n, 1);
  ready = true; client.emit(Events.ClientReady);
  await waitFor(() => db.prepare('SELECT COUNT(*) AS n FROM autorole_jobs').get().n === 0);
  service.stop();
  assert.equal(client.listenerCount(Events.ClientReady), 0);
});
