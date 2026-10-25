import test from 'node:test';
import assert from 'node:assert/strict';
import { accessLevel, earnedLevelRoles, isActiveVoiceMember, levelForXp, progressForXp, qualifiedMessage, reconcileVoiceSessions, xpForLevel } from '../src/level-helpers.js';

test('slow progression has exact boundaries and monotonically increasing next-level costs', () => {
  assert.equal(xpForLevel(1), 1000);
  assert.equal(xpForLevel(5), 10000);
  assert.equal(xpForLevel(50), 662500);
  for (let level = 1; level <= 1000; level += 1) {
    assert.equal(levelForXp(xpForLevel(level)), level);
    assert.equal(levelForXp(xpForLevel(level) - 0.5), level - 1);
    assert.ok(xpForLevel(level + 1) - xpForLevel(level) > xpForLevel(level) - xpForLevel(level - 1));
  }
  assert.deepEqual(progressForXp(1000.5), { level: 1, currentXp: 0.5, neededXp: 1500 });
});

test('message qualification rejects spam, early and replayed timestamps, and short posts', () => {
  const opts = { minMessageLength: 8, messageCooldownSeconds: 60 };
  const first = qualifiedMessage('Cześć wszystkim na serwerze!', undefined, 100000, opts);
  assert.ok(first.qualifies);
  const previous = { last_message_at: 100000, last_message_hash: first.hash };
  assert.equal(qualifiedMessage('Wiadomość przed czasem', previous, 159999, opts).qualifies, false);
  assert.equal(qualifiedMessage('Inna wiadomość po minucie', previous, 160000, opts).qualifies, true);
  assert.equal(qualifiedMessage('  CZEŚĆ   WSZYSTKIM na serwerze! ', previous, 160000, opts).qualifies, false);
  assert.equal(qualifiedMessage('Cześć wszystkim na serwerze!', previous, 400000, opts).qualifies, true);
  assert.equal(qualifiedMessage('stara wiadomość', previous, 99000, opts).qualifies, false);
  assert.equal(qualifiedMessage('!!!!!??????', undefined, 100000, opts).qualifies, false);
  assert.equal(qualifiedMessage('hi', undefined, 100000, opts).qualifies, false);
  assert.equal(qualifiedMessage('', undefined, 100000, opts).qualifies, false);
});

test('role rewards are cumulative and manually assigned milestone roles count for access', () => {
  const roles = { 5: 'five', 10: 'ten', 20: 'twenty', 50: 'fifty' };
  assert.deepEqual(earnedLevelRoles(4, roles), []);
  assert.deepEqual(earnedLevelRoles(20, roles), ['five', 'ten', 'twenty']);
  assert.equal(accessLevel(0, new Set(['ten']), roles), 10);
  assert.equal(accessLevel(30, new Set(['five']), roles), 30);
});

test('voice requires humans who are not AFK, muted, deafened or stage-suppressed', () => {
  const member = { user: { bot: false }, voice: { channelId: 'voice' } };
  assert.equal(isActiveVoiceMember(member, 'afk'), true);
  assert.equal(isActiveVoiceMember({ ...member, user: { bot: true } }, 'afk'), false);
  assert.equal(isActiveVoiceMember(member, 'voice'), false);
  for (const flag of ['mute', 'deaf', 'selfMute', 'serverMute', 'selfDeaf', 'serverDeaf', 'suppress']) {
    assert.equal(isActiveVoiceMember({ ...member, voice: { ...member.voice, [flag]: true } }, 'afk'), false, flag);
  }
});

test('voice accrual preserves continuous presence but resets after movement or loss of eligibility', () => {
  const sessions = new Map();
  reconcileVoiceSessions(sessions, new Map([['u', { channelId: 'a' }]]), 0);
  reconcileVoiceSessions(sessions, new Map([['u', { channelId: 'a' }]]), 299999);
  assert.equal(sessions.get('u').since, 0);
  reconcileVoiceSessions(sessions, new Map([['u', { channelId: 'b' }]]), 300000);
  assert.equal(sessions.get('u').since, 300000);
  reconcileVoiceSessions(sessions, new Map(), 400000);
  assert.equal(sessions.size, 0);
  reconcileVoiceSessions(sessions, new Map([['u', { channelId: 'b' }]]), 500000);
  assert.equal(sessions.get('u').since, 500000);
});
