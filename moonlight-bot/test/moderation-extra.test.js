import test from 'node:test';
import assert from 'node:assert/strict';
import { ChannelType, MessageFlags } from 'discord.js';

process.env.DATABASE_PATH = ':memory:';
process.env.GUILD_ID = '123456789012345678';
const { config } = await import('../src/config.js');
const { db } = await import('../src/db.js');
const { handleExtraModeration } = await import('../src/moderation-extra.js');

function environment() {
  const users = new Map();
  const calls = { kicks: [], deletes: [], slowmodes: [], logs: [] };
  const bot = { id: '222222222222222222', permissions: { has: () => true }, roles: { highest: { comparePositionTo: () => 1 } } };
  const guild = { id: config.guildId, ownerId: '111111111111111111', members: {
    fetch: async value => {
      const member = users.get(typeof value === 'string' ? value : value.user);
      if (!member) throw Object.assign(new Error('Unknown member'), { code: 10007 });
      return member;
    },
    fetchMe: async () => bot,
  } };
  const channel = { id: '444444444444444444', guildId: guild.id, type: ChannelType.GuildText,
    isTextBased: () => true, permissionsFor: () => ({ has: () => true }),
    messages: { fetch: async () => new Map() },
    bulkDelete: async (messages, filterOld) => {
      calls.deletes.push({ messages, filterOld });
      return new Map(messages.map(message => [message.id, message]));
    },
    setRateLimitPerUser: async seconds => calls.slowmodes.push(seconds),
    send: async payload => calls.logs.push(payload),
  };
  guild.channels = { fetch: async () => channel };
  const client = { channels: { fetch: async () => channel } };
  function member(id, role = null, position = 5) {
    const result = { id, guild, user: { id, bot: false, username: id }, kickable: true, manageable: true,
      roles: { cache: new Map(role ? [[role, true]] : []), highest: { position, comparePositionTo: other => position - other.position } },
      kick: async reason => calls.kicks.push({ id, reason }),
    };
    users.set(id, result);
    return result;
  }
  const admin = member('555555555555555555', config.roles.admin, 50);
  function interaction(commandName, options = {}, actor = admin) {
    const replies = [];
    return { commandName, guild, guildId: guild.id, client, channel, user: actor.user, member: actor,
      replies, deferred: false, replied: false, isChatInputCommand: () => true,
      options: { getString: key => options[key] ?? null, getUser: key => options[key] ?? null,
        getInteger: key => options[key] ?? null, getChannel: key => options[key] ?? null },
      async deferReply(payload) { this.deferred = true; this.deferPayload = payload; },
      async editReply(payload) { replies.push(payload); },
      async reply(payload) { replies.push(payload); },
      async followUp(payload) { replies.push(payload); },
    };
  }
  return { member, interaction, admin, users, guild, bot, channel, calls };
}

test('helper cannot kick but the configured bot owner can kick without any role', async () => {
  const env = environment();
  const helper = env.member('666666666666666666', config.roles.helper, 20);
  const target = env.member('777777777777777777', null, 30);
  const denied = env.interaction('kick', { osoba: target.user, powod: 'test' }, helper);
  assert.equal(await handleExtraModeration(denied), true);
  assert.match(denied.replies.at(-1).content, /Admin lub Szef/);
  assert.equal(env.calls.kicks.length, 0);
  const owner = env.member('1488470377993736234', null, 0);
  const allowed = env.interaction('kick', { osoba: target.user, powod: 'spam' }, owner);
  await handleExtraModeration(allowed);
  assert.equal(env.calls.kicks.length, 1);
  assert.equal(env.calls.kicks[0].id, target.id);
  assert.match(env.calls.kicks[0].reason, new RegExp(owner.id));
  assert.equal(allowed.deferPayload.flags, MessageFlags.Ephemeral);
});

test('even the bot owner cannot kick when Discord bot permissions or hierarchy forbid it', async () => {
  const env = environment();
  const owner = env.member('1488470377993736234', null, 0);
  const target = env.member('777777777777777777');
  env.bot.permissions.has = () => false;
  const permission = env.interaction('kick', { osoba: target.user, powod: 'test' }, owner);
  await handleExtraModeration(permission);
  assert.match(permission.replies.at(-1).content, /Bot nie ma wymaganego uprawnienia/);
  env.bot.permissions.has = () => true;
  env.bot.roles.highest.comparePositionTo = () => 0;
  const hierarchy = env.interaction('kick', { osoba: target.user, powod: 'test' }, owner);
  await handleExtraModeration(hierarchy);
  assert.match(hierarchy.replies.at(-1).content, /Przenieś rolę bota/);
  assert.equal(env.calls.kicks.length, 0);
});

test('clear filters old, pinned and other authors, then reports the actual Discord deletion count', async () => {
  const env = environment();
  const author = { id: '777777777777777777' };
  const message = (id, age, pinned = false, user = author) => ({ id, createdTimestamp: Date.now() - age, pinned, author: user });
  const candidates = [message('old', 15 * 86_400_000), message('pinned', 100, true),
    message('other', 200, false, { id: 'other-user' }), message('recent-2', 2000), message('recent-1', 1000), message('recent-3', 3000)];
  env.channel.messages.fetch = async options => {
    assert.deepEqual(options, { limit: 100 });
    return new Map(candidates.map(m => [m.id, m]));
  };
  env.channel.bulkDelete = async (messages, filterOld) => {
    env.calls.deletes.push({ messages, filterOld });
    // One of the selected messages disappeared before Discord processed the request.
    return new Map([[messages[0].id, messages[0]]]);
  };
  const i = env.interaction('clear', { ilosc: 2, osoba: author });
  await handleExtraModeration(i);
  assert.deepEqual(env.calls.deletes[0].messages.map(m => m.id), ['recent-1', 'recent-2']);
  assert.equal(env.calls.deletes[0].filterOld, true);
  assert.match(i.replies.at(-1).content, /Usunięto \*\*1\*\*/);
  assert.match(i.replies.at(-1).content, /ostatnie 6/);
});

test('clear refuses missing channel permissions and invalid amount before deleting anything', async () => {
  const env = environment();
  env.channel.permissionsFor = member => ({ has: () => member.id !== env.bot.id });
  const denied = env.interaction('clear', { ilosc: 5 });
  await handleExtraModeration(denied);
  assert.match(denied.replies.at(-1).content, /Bot nie ma wymaganych uprawnień/);
  env.channel.permissionsFor = () => ({ has: () => true });
  const invalid = env.interaction('clear', { ilosc: 101 });
  await handleExtraModeration(invalid);
  assert.match(invalid.replies.at(-1).content, /1–100/);
  assert.equal(env.calls.deletes.length, 0);
});

test('warnings persist with moderator and reason, and revocation retains their audit history', async () => {
  db.exec('DELETE FROM warnings');
  const env = environment();
  const helper = env.member('666666666666666666', config.roles.helper, 20);
  const target = env.member('777777777777777777');
  await handleExtraModeration(env.interaction('warn', { osoba: target.user, powod: 'Powtarzany spam' }, helper));
  const saved = db.prepare('SELECT * FROM warnings WHERE guild_id=? AND user_id=?').get(env.guild.id, target.id);
  assert.equal(saved.reason, 'Powtarzany spam');
  assert.equal(saved.moderator_id, helper.id);
  assert.equal(saved.revoked_at, null);
  const helperRevoke = env.interaction('unwarn', { id: saved.id, powod: 'Pomylka' }, helper);
  await handleExtraModeration(helperRevoke);
  assert.match(helperRevoke.replies.at(-1).content, /Admin lub Szef/);
  assert.equal(db.prepare('SELECT revoked_at FROM warnings WHERE id=?').get(saved.id).revoked_at, null);
  await handleExtraModeration(env.interaction('unwarn', { id: saved.id, powod: 'Wyjaśnione' }));
  const revoked = db.prepare('SELECT * FROM warnings WHERE id=?').get(saved.id);
  assert.ok(revoked.revoked_at > 0);
  assert.equal(revoked.revoked_by, env.admin.id);
  assert.equal(revoked.revoke_reason, 'Wyjaśnione');
  assert.equal(revoked.reason, saved.reason);
  const self = env.interaction('warny', {}, target);
  await handleExtraModeration(self);
  assert.match(self.replies.at(-1).embeds[0].toJSON().description, /Aktywne ostrzeżenia: \*\*0\*\*/);
});

test('ordinary members may see only their own warnings and replies are private', async () => {
  db.exec('DELETE FROM warnings');
  const env = environment();
  const first = env.member('777777777777777777');
  const second = env.member('888888888888888888');
  db.prepare('INSERT INTO warnings(guild_id,user_id,moderator_id,reason,created_at) VALUES(?,?,?,?,?)')
    .run(env.guild.id, first.id, env.admin.id, 'Własne ostrzeżenie', Date.now());
  const self = env.interaction('warny', {}, first);
  await handleExtraModeration(self);
  assert.equal(self.deferPayload.flags, MessageFlags.Ephemeral);
  assert.match(self.replies.at(-1).embeds[0].toJSON().fields[0].value, /Własne ostrzeżenie/);
  const denied = env.interaction('warny', { osoba: first.user }, second);
  await handleExtraModeration(denied);
  assert.match(denied.replies.at(-1).content, /tylko własne/);
  assert.equal(denied.replies.at(-1).embeds, undefined);
});

test('slowmode accepts both bounds and rejects out-of-range and fractional durations', async () => {
  const env = environment();
  for (const seconds of [0, 21600]) await handleExtraModeration(env.interaction('slowmode', { sekundy: seconds }));
  assert.deepEqual(env.calls.slowmodes, [0, 21600]);
  for (const seconds of [-1, 21601, 1.5]) {
    const invalid = env.interaction('slowmode', { sekundy: seconds });
    await handleExtraModeration(invalid);
    assert.match(invalid.replies.at(-1).content, /0–21600/);
  }
  assert.deepEqual(env.calls.slowmodes, [0, 21600]);
});
