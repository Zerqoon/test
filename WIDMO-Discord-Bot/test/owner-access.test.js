import test from 'node:test';
import assert from 'node:assert/strict';
import { ChannelType } from 'discord.js';
import { VOICE_FLAGS as F, planOverwrites } from '../src/voice-policy.js';

process.env.DATABASE_PATH = ':memory:';
process.env.GUILD_ID = '123456789012345678';
const { config } = await import('../src/config.js');
const { isBotOwner, staffTier, canModerate } = await import('../src/shared.js');
const { handleCommand } = await import('../src/commands.js');
const { checkMessage } = await import('../src/automod.js');
const ownerId = '1488470377993736234';

function environment() {
  const users = new Map();
  const calls = { bans: [], timeouts: [] };
  const bot = { id: '222222222222222222', permissions: { has: () => true }, roles: { highest: { comparePositionTo: () => 1 } } };
  const guild = { id: config.guildId, ownerId: '111111111111111111', members: {
    fetch: async value => {
      const member = users.get(typeof value === 'string' ? value : value.user);
      if (!member) throw Object.assign(new Error('Unknown member'), { code: 10007 });
      return member;
    },
    fetchMe: async () => bot,
    ban: async (id, options) => calls.bans.push({ id, reason: options.reason }),
  }, bans: { fetch: async () => { throw Object.assign(new Error('Unknown ban'), { code: 10026 }); } } };
  const channel = { id: '444444444444444444', guild, guildId: guild.id, type: ChannelType.GuildText,
    isTextBased: () => true, send: async () => {}, permissionsFor: () => ({ has: () => true }) };
  const client = { user: bot, channels: { fetch: async () => channel } };
  function member(id, role = null, position = 5) {
    const result = { id, guild, user: { id, bot: false, username: id }, moderatable: true, bannable: true,
      roles: { cache: new Map(role ? [[role, true]] : []), highest: { position, comparePositionTo: other => position - other.position } },
      timeout: async (duration, reason) => calls.timeouts.push({ id, duration, reason }),
    };
    users.set(id, result);
    return result;
  }
  const owner = member(ownerId, null, 0);
  function interaction(commandName, options, actor = owner) {
    const replies = [];
    return { commandName, guild, guildId: guild.id, client, channel, user: actor.user, member: actor,
      replies, deferred: false, replied: false, isChatInputCommand: () => true,
      options: { getString: key => options[key] ?? null, getUser: key => options[key] ?? null },
      async deferReply() { this.deferred = true; },
      async editReply(payload) { replies.push(payload); },
      async reply(payload) { replies.push(payload); },
      async followUp(payload) { replies.push(payload); },
    };
  }
  return { member, owner, users, guild, calls, interaction };
}

test('configured owner identity grants tier four without any role and outranks the staff owner role', () => {
  const env = environment();
  const staffOwner = env.member('333333333333333333', config.roles.owner, 50);
  assert.equal(env.owner.roles.cache.size, 0);
  assert.equal(isBotOwner(ownerId), true);
  assert.equal(isBotOwner(env.owner.user), true);
  assert.equal(staffTier(env.owner), 4);
  assert.equal(staffTier(staffOwner), 3);
  assert.equal(canModerate(env.owner, staffOwner, 2), true);
  assert.equal(canModerate(staffOwner, env.owner, 2), false);
});

test('owner hierarchy bypass retains protection for self, bots, server owner and other bot owners', () => {
  const env = environment();
  const higherMember = env.member('333333333333333333', null, 99);
  const botMember = env.member('444444444444444444');
  botMember.user.bot = true;
  const serverOwner = env.member(env.guild.ownerId);
  const anotherOwner = env.member('555555555555555555');
  const original = config.ownerIds;
  config.ownerIds = [...original, anotherOwner.id];
  try {
    assert.equal(canModerate(env.owner, higherMember, 2), true);
    for (const target of [env.owner, botMember, serverOwner, anotherOwner]) {
      assert.equal(canModerate(env.owner, target, 2), false, target.id);
    }
  } finally { config.ownerIds = original; }
});

test('existing mute and ban handlers accept a roleless owner against a higher-role member', async () => {
  const env = environment();
  const target = env.member('777777777777777777', config.roles.admin, 50);
  const mute = env.interaction('mute', { osoba: target.user, powod: 'spam', czas: '10m' });
  await handleCommand(mute);
  assert.equal(env.calls.timeouts.length, 1);
  assert.equal(env.calls.timeouts[0].duration, 600_000);
  const ban = env.interaction('ban', { osoba: target.user, powod: 'naruszenie regulaminu' });
  await handleCommand(ban);
  assert.equal(env.calls.bans.length, 1);
  assert.equal(env.calls.bans[0].id, target.id);
  assert.match(env.calls.bans[0].reason, new RegExp(ownerId));
  assert.ok(mute.replies.at(-1).embeds);
  assert.ok(ban.replies.at(-1).embeds);
});

test('ban cannot target a configured owner who has left the server', async () => {
  const env = environment();
  env.users.delete(ownerId);
  const admin = env.member('777777777777777777', config.roles.admin, 50);
  const i = env.interaction('ban', { osoba: { id: ownerId }, powod: 'test' }, admin);
  await handleCommand(i);
  assert.equal(env.calls.bans.length, 0);
  assert.match(i.replies.at(-1).content, /właściciel|chronion/);
});

test('voice permissions keep the bot owner present and able to use chat even on locked hidden channels', () => {
  const access = F.Connect | F.ViewChannel | F.SendMessages | F.ReadMessageHistory | F.Speak;
  const plan = planOverwrites([{ id: ownerId, type: 1, allow: '0', deny: access.toString() }], {
    guildId: 'guild', ownerId: 'room-owner', botId: 'bot', staffUserIds: [ownerId],
    blockedIds: [ownerId, 'blocked-user'], locked: true, hidden: true,
  });
  const ownerOverwrite = plan.find(item => item.id === ownerId);
  assert.equal(ownerOverwrite.type, 1);
  assert.equal(BigInt(ownerOverwrite.allow) & access, access);
  assert.equal(BigInt(ownerOverwrite.deny) & access, 0n);
  const blocked = plan.find(item => item.id === 'blocked-user');
  assert.equal(BigInt(blocked.deny) & (F.Connect | F.ViewChannel), F.Connect | F.ViewChannel);
});

test('automod lets a roleless owner post media and arbitrary normal links but still blocks Discord invites', () => {
  const env = environment();
  const message = (content, extra = {}) => ({ guild: env.guild, author: env.owner.user, member: env.owner,
    content, embeds: [], attachments: new Map(), stickers: new Map(), ...extra });
  // Partial/mock messages can omit channelId. They must not trigger an invalid SQLite bind.
  assert.equal(checkMessage({ guild: env.guild, author: env.owner.user, member: env.owner, content: 'hello',
    embeds: [], attachments: new Map([['image', {}]]), stickers: new Map() }).allowed, true);
  assert.equal(checkMessage(message('', { attachments: new Map([['image', {}]]) })).allowed, true);
  assert.equal(checkMessage(message('', { stickers: new Map([['sticker', {}]]) })).allowed, true);
  assert.equal(checkMessage(message('https://example.org/something')).allowed, true);
  assert.equal(checkMessage(message('https://discord.gg/example')).allowed, false);
  assert.equal(checkMessage(message('Discord', { embeds: [{ url: 'https://discord.com/invite/example' }] })).allowed, false);
  const ordinary = env.member('777777777777777777');
  assert.equal(checkMessage({ ...message('https://example.org'), author: ordinary.user, member: ordinary }).allowed, false);
});
