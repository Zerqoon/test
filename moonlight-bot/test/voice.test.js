import test from 'node:test';
import assert from 'node:assert/strict';
import { VOICE_FLAGS as F, normalizeChannelName, parseVoiceLimit, planOverwrites, createSerialQueue, canClaimVoice } from '../src/voice-policy.js';

const common = { guildId: 'guild', ownerId: 'owner', botId: 'bot', staffRoleIds: ['admin'] };
const record = (id, allow = 0n, deny = 0n, type = 0) => ({ id, allow: String(allow), deny: String(deny), type });
const bits = (plan, id, mode) => BigInt(plan.find(item => item.id === id)[mode]);

test('voice lock denies inherited role/member bypasses while retaining permissions unrelated to access', () => {
  const base = [record('guild', F.Connect | F.ViewChannel), record('veteran', F.Connect | F.Speak), record('inherited-user', F.Connect, F.SendMessages, 1)];
  const plan = planOverwrites(base, { ...common, locked: true });
  for (const id of ['guild', 'veteran', 'inherited-user']) {
    assert.equal(bits(plan, id, 'allow') & F.Connect, 0n);
    assert.equal(bits(plan, id, 'deny') & F.Connect, F.Connect);
  }
  assert.equal(bits(plan, 'veteran', 'allow') & F.Speak, F.Speak);
  assert.equal(bits(plan, 'inherited-user', 'deny') & F.SendMessages, F.SendMessages);
  for (const id of ['owner', 'bot', 'admin']) assert.equal(bits(plan, id, 'allow') & F.Connect, F.Connect);
  assert.deepEqual(base[0], record('guild', F.Connect | F.ViewChannel));
});

test('unlock restores original category restrictions instead of globally allowing everyone', () => {
  const base = [record('guild', 0n, F.Connect), record('member-role', F.Connect, F.SendMessages)];
  const locked = planOverwrites(base, { ...common, locked: true });
  assert.equal(bits(locked, 'member-role', 'allow') & F.Connect, 0n);
  const unlocked = planOverwrites(base, common);
  assert.equal(bits(unlocked, 'guild', 'deny') & F.Connect, F.Connect);
  assert.equal(bits(unlocked, 'member-role', 'allow') & F.Connect, F.Connect);
  assert.equal(bits(unlocked, 'member-role', 'deny') & F.SendMessages, F.SendMessages);
});

test('private channel grants invited users access, blocks a removed guest, preserves owner and bot', () => {
  const plan = planOverwrites([record('guild', F.Connect | F.ViewChannel)], {
    ...common, locked: true, hidden: true, allowedIds: ['guest'], blockedIds: ['blocked', 'owner', 'bot'],
  });
  const access = F.Connect | F.ViewChannel;
  for (const id of ['guest', 'owner', 'bot']) {
    assert.equal(bits(plan, id, 'allow') & access, access);
    assert.equal(bits(plan, id, 'deny') & access, 0n);
  }
  assert.equal(bits(plan, 'blocked', 'deny') & access, access);
  assert.equal(bits(plan, 'blocked', 'allow') & access, 0n);
  assert.equal(bits(plan, 'bot', 'allow') & F.ManageChannels, F.ManageChannels);
});

test('ownership transfer removes former owner special access when room is locked', () => {
  const next = planOverwrites([record('guild')], { ...common, ownerId: 'new-owner', locked: true });
  assert.equal(next.some(item => item.id === 'owner'), false);
  assert.equal(bits(next, 'new-owner', 'allow') & F.Connect, F.Connect);
});

test('overwrite planner refuses exceeding Discord overwrite limits', () => {
  const base = Array.from({ length: 100 }, (_, i) => record(`role-${i}`));
  assert.throws(() => planOverwrites(base, common), /Za dużo/);
});

test('voice limits and channel names reject invalid input and invisible controls', () => {
  for (const valid of ['0', '99', '10', ' 2 ']) assert.equal(parseVoiceLimit(valid), Number(valid));
  for (const invalid of ['100', '-1', '1.2', '1e1', 'abc', '']) assert.throws(() => parseVoiceLimit(invalid));
  assert.equal(normalizeChannelName('  🌙  pokój\n  Ani\u202e '), '🌙 pokój Ani');
  assert.throws(() => normalizeChannelName('\u200b\u202e'));
  assert.throws(() => normalizeChannelName('a'.repeat(101)));
});

test('claim requires owner absence and claimant current presence, never a bot', () => {
  const row = { owner_id: 'owner' };
  const member = { id: 'next', user: { bot: false }, voice: { channelId: 'voice' } };
  const channel = { id: 'voice', members: new Map([['next', member]]) };
  assert.equal(canClaimVoice(row, member, channel), true);
  channel.members.set('owner', {});
  assert.equal(canClaimVoice(row, member, channel), false);
  channel.members.delete('owner');
  assert.equal(canClaimVoice(row, { ...member, voice: { channelId: 'other' } }, channel), false);
  assert.equal(canClaimVoice(row, { ...member, user: { bot: true } }, channel), false);
});

test('channel serialization prevents overlapping mutation; failure does not block later work or other channels', async () => {
  const serial = createSerialQueue();
  const order = [];
  let unblock;
  const gate = new Promise(resolve => { unblock = resolve; });
  const a = serial('one', async () => { order.push('a:start'); await gate; order.push('a:fail'); throw new Error('expected'); });
  const b = serial('one', async () => { order.push('b'); return 'ok'; });
  await serial('two', async () => { order.push('other'); });
  assert.deepEqual(order, ['a:start', 'other']);
  unblock();
  await assert.rejects(a, /expected/);
  assert.equal(await b, 'ok');
  assert.deepEqual(order, ['a:start', 'other', 'a:fail', 'b']);
});
