import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseWinners, giveawayEligibility, banReason, isManagedBan } from '../src/giveaway-utils.js';

test('drawing caps winners, removes duplicate entries, never mutates candidates', () => {
  const entrants = ['a', 'b', 'a', 'c'];
  const winners = chooseWinners(entrants, 20);
  assert.equal(winners.length, 3);
  assert.equal(new Set(winners).size, 3);
  assert.deepEqual(entrants, ['a', 'b', 'a', 'c']);
  assert.deepEqual(chooseWinners([], 5), []);
  assert.deepEqual(chooseWinners(entrants, 0), []);
});

test('drawing includes the last candidate and uses bounded sampling without replacement', () => {
  const calls = [];
  const winners = chooseWinners(['a', 'b', 'c', 'd'], 3, (min, max) => {
    calls.push([min, max]);
    return max - 1;
  });
  assert.deepEqual(calls, [[0, 4], [1, 4], [2, 4]]);
  assert.deepEqual(winners, ['d', 'a', 'b']);
});

test('giveaway checks current role, qualified messages, presence and bot status', () => {
  const member = { user: { bot: false }, roles: { cache: new Map([['vip', true]]) } };
  assert.equal(giveawayEligibility(member, 'vip', 50, 50), null);
  assert.match(giveawayEligibility(member, 'vip', 50, 49), /Masz 49/);
  assert.match(giveawayEligibility(member, 'other', 50, 100), /Wymagana rola/);
  assert.match(giveawayEligibility(null, null, 0, 0), /obecni/);
  assert.match(giveawayEligibility({ ...member, user: { bot: true } }, null, 0, 0), /użytkownicy/);
});

test('timed ban marker is preserved at API limit and cannot match a later manual ban', () => {
  const reason = banReason('123456789', 'X'.repeat(1000), 'unique-marker');
  assert.ok(reason.length <= 500);
  assert.equal(isManagedBan(reason, 'unique-marker'), true);
  assert.equal(isManagedBan('later manual ban', 'unique-marker'), false);
  assert.equal(isManagedBan(reason, 'other-marker'), false);
  assert.equal(isManagedBan(null, 'unique-marker'), false);
});
