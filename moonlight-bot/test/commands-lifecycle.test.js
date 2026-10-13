import test from 'node:test';
import assert from 'node:assert/strict';
import { ChannelType } from 'discord.js';

process.env.DATABASE_PATH = ':memory:';
process.env.GUILD_ID = '123456789012345678';
const { config } = await import('../src/config.js');
const { db } = await import('../src/db.js');
const { handleCommand, installModeration, rulesEmbed } = await import('../src/commands.js');
const { handleGiveawayCommand, handleGiveawayInteraction, installGiveaways } = await import('../src/giveaways.js');

const guildId = config.guildId;
function environment() {
  const users = new Map();
  const bans = new Map();
  const calls = { edits: [], sent: [], bans: [], unbans: [], timeouts: [] };
  const bot = { id: '222222222222222222', permissions: { has: () => true }, roles: { highest: { comparePositionTo: () => 1 } } };
  const guild = {
    id: guildId, ownerId: '111111111111111111',
    members: {
      fetch: async value => {
        const member = users.get(typeof value === 'string' ? value : value.user);
        if (!member) throw Object.assign(new Error('Unknown member'), { code: 10007 });
        return member;
      },
      fetchMe: async () => bot,
      ban: async (id, options) => { calls.bans.push(id); bans.set(id, { reason: options.reason }); },
      unban: async id => { calls.unbans.push(id); bans.delete(id); },
    },
    bans: { fetch: async id => {
      if (!bans.has(id)) throw Object.assign(new Error('Unknown ban'), { code: 10026 });
      return bans.get(id);
    } },
  };
  const message = { id: '333333333333333333', author: { id: bot.id }, url: 'https://discord.com/channels/g/c/m',
    edit: async payload => { calls.edits.push(payload); return message; } };
  const channel = { id: '444444444444444444', guild, guildId, type: ChannelType.GuildText,
    isTextBased: () => true, permissionsFor: () => ({ has: () => true }),
    messages: { fetch: async () => message },
    send: async payload => { calls.sent.push(payload); return message; },
  };
  guild.channels = { fetch: async () => channel };
  const client = { user: bot, isReady: () => true, guilds: { fetch: async () => guild }, channels: { fetch: async () => channel } };
  function member(id, role = null, position = 5) {
    const result = { id, guild, user: { id, bot: false, username: id }, moderatable: true, bannable: true,
      roles: { cache: new Map(role ? [[role, true]] : []), highest: { position, comparePositionTo: other => position - other.position } },
      timeout: async (duration, reason) => calls.timeouts.push({ id, duration, reason }),
    };
    users.set(id, result);
    return result;
  }
  const admin = member('555555555555555555', config.roles.admin, 50);
  function interaction(commandName, options = {}, actor = admin) {
    const replies = [];
    return { commandName, guild, guildId, client, channel, user: actor.user, member: actor, message,
      deferred: false, replied: false, replies,
      isChatInputCommand: () => true, isButton: () => false, isModalSubmit: () => false,
      options: { getString: key => options[key] ?? null, getUser: key => options[key] ?? null,
        getInteger: key => options[key] ?? null, getRole: key => options[key] ?? null,
        getChannel: key => options[key] ?? null, getSubcommand: () => options.sub },
      async deferReply() { this.deferred = true; },
      async editReply(payload) { replies.push(payload); },
      async reply(payload) { replies.push(payload); },
      async followUp(payload) { replies.push(payload); },
    };
  }
  return { guild, users, bans, calls, member, admin, interaction, client, message, channel };
}

async function eventually(predicate) {
  for (let count = 0; count < 100; count += 1) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.fail('Background reconciliation did not finish');
}

test('helper may timeout but cannot ban, and actor hierarchy is enforced', async () => {
  const env = environment();
  const helper = env.member('666666666666666666', config.roles.helper, 20);
  const user = env.member('777777777777777777', null, 10);
  const ban = env.interaction('ban', { osoba: user.user, powod: 'test' }, helper);
  await handleCommand(ban);
  assert.equal(env.calls.bans.length, 0);
  assert.match(ban.replies.at(-1).content, /Admin lub Szef/);
  const mute = env.interaction('mute', { osoba: user.user, powod: 'spam', czas: '10m' }, helper);
  await handleCommand(mute);
  assert.equal(env.calls.timeouts.at(-1).duration, 600_000);
  const protectedUser = env.member('888888888888888888', null, 25);
  const denied = env.interaction('mute', { osoba: protectedUser.user, powod: 'test', czas: '1m' }, helper);
  await handleCommand(denied);
  assert.equal(env.calls.timeouts.length, 1);
  assert.match(denied.replies.at(-1).content, /hierarchią/);
  const tooLong = env.interaction('mute', { osoba: user.user, powod: 'test', czas: '29d' }, helper);
  await handleCommand(tooLong);
  assert.equal(env.calls.timeouts.length, 1);
});

test('timed bans survive scheduling and a later manual ban is never removed', async () => {
  db.exec('DELETE FROM timed_bans');
  const env = environment();
  const user = env.member('777777777777777777');
  await handleCommand(env.interaction('ban', { osoba: user.user, powod: 'test', czas: '1h' }));
  const job = db.prepare('SELECT * FROM timed_bans WHERE user_id=?').get(user.id);
  assert.equal(job.state, 'active');
  assert.ok(env.bans.get(user.id).reason.includes(job.marker));
  db.prepare('UPDATE timed_bans SET expires_at=0 WHERE user_id=?').run(user.id);
  env.bans.set(user.id, { reason: 'Późniejszy ręczny ban' });
  const schedule = installModeration(env.client);
  try { await eventually(() => !db.prepare('SELECT 1 FROM timed_bans WHERE user_id=?').get(user.id)); }
  finally { schedule.stop(); }
  assert.deepEqual(env.calls.unbans, []);
  assert.equal(env.bans.has(user.id), true);
});

test('overdue managed ban is removed after restart', async () => {
  db.exec('DELETE FROM timed_bans');
  const env = environment();
  const userId = '999999999999999999';
  db.prepare("INSERT INTO timed_bans(guild_id,user_id,marker,expires_at,state) VALUES(?,?,?,0,'pending')").run(guildId, userId, 'restart-test');
  env.bans.set(userId, { reason: 'Reason | auto:restart-test' });
  const schedule = installModeration(env.client);
  try { await eventually(() => !db.prepare('SELECT 1 FROM timed_bans WHERE user_id=?').get(userId)); }
  finally { schedule.stop(); }
  assert.deepEqual(env.calls.unbans, [userId]);
});

function seedGiveaway(env, id, { role = null, minMessages = 0 } = {}) {
  db.prepare(`INSERT INTO giveaways(id,guild_id,channel_id,message_id,host_id,prize,description,role_id,min_messages,winner_count,ends_at,created_at,status)
    VALUES(?,?,?,?,?,'Nagroda','Opis',?,?,2,?,?,'open')`).run(id, guildId, env.channel.id, env.message.id, env.admin.id, role, minMessages, Date.now() + 60_000, Date.now());
}

test('giveaway rechecks roles and messages at drawing, then retries the saved result after announcement failure', async () => {
  db.exec('DELETE FROM giveaway_entries; DELETE FROM giveaways; DELETE FROM level_stats;');
  const env = environment();
  const vip = 'vip';
  const qualified = env.member('700000000000000001', vip);
  const lostRole = env.member('700000000000000002');
  const tooFewMessages = env.member('700000000000000003', vip);
  const missing = '700000000000000004';
  const id = 'draw-test';
  seedGiveaway(env, id, { role: vip, minMessages: 5 });
  for (const userId of [qualified.id, lostRole.id, tooFewMessages.id, missing]) {
    db.prepare('INSERT INTO giveaway_entries VALUES(?,?,?)').run(id, userId, Date.now());
    db.prepare('INSERT INTO level_stats(guild_id,user_id,messages) VALUES(?,?,?)').run(guildId, userId, userId === tooFewMessages.id ? 4 : 5);
  }
  const originalEdit = env.message.edit;
  env.message.edit = async () => { throw new Error('Simulated temporary network failure'); };
  await handleGiveawayCommand(env.interaction('giveaway', { sub: 'koniec', id }));
  const saved = db.prepare('SELECT * FROM giveaways WHERE id=?').get(id);
  assert.equal(saved.status, 'finished');
  assert.equal(saved.announced, 0);
  assert.deepEqual(JSON.parse(saved.winners), [qualified.id]);
  // The role is gone before retry, but the already committed result must not redraw.
  qualified.roles.cache.clear();
  env.message.edit = originalEdit;
  const schedule = installGiveaways(env.client);
  try { await eventually(() => db.prepare('SELECT announced FROM giveaways WHERE id=?').get(id).announced === 1); }
  finally { schedule.stop(); }
  const retried = db.prepare('SELECT * FROM giveaways WHERE id=?').get(id);
  assert.equal(retried.winners, saved.winners);
  assert.match(env.calls.edits.at(-1).embeds[0].toJSON().fields.find(field => field.name.includes('Zwycięzcy')).value, new RegExp(qualified.id));
});

test('joining giveaway rejects unmet requirements and avoids duplicate entries', async () => {
  db.exec('DELETE FROM giveaway_entries; DELETE FROM giveaways; DELETE FROM level_stats;');
  const env = environment();
  const person = env.member('700000000000000001');
  seedGiveaway(env, 'join-test', { minMessages: 3 });
  const button = () => Object.assign(env.interaction('', {}, person), {
    customId: 'giveaway:join:join-test', isChatInputCommand: () => false, isButton: () => true,
  });
  const rejected = button();
  await handleGiveawayInteraction(rejected);
  assert.match(rejected.replies.at(-1).content, /Wymagane 3/);
  db.prepare('INSERT INTO level_stats(guild_id,user_id,messages) VALUES(?,?,3)').run(guildId, person.id);
  await handleGiveawayInteraction(button());
  await handleGiveawayInteraction(button());
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM giveaway_entries WHERE giveaway_id=?').get('join-test').total, 1);
});

test('rules payload respects Discord embed field size limits', () => {
  const card = rulesEmbed().toJSON();
  for (const field of card.fields) assert.ok(field.value.length <= 1024);
  assert.ok(JSON.stringify(card).length < 6000);
});
