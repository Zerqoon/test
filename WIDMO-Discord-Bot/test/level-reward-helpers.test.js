import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLevelRewards, setLevelReward, removeLevelReward, levelRoleDiff } from '../src/level-reward-helpers.js';

const ROLE_A = '1515440522225913926';
const ROLE_B = '1563993794536284190';
const ROLE_C = '1517165022151704626';

test('normalizes reward thresholds into numeric order and deduplicates retired roles', () => {
  assert.deepEqual(normalizeLevelRewards({ '20': ROLE_B, '5': ROLE_A }, [ROLE_C, ROLE_C, ROLE_A]), {
    levels: { '5': ROLE_A, '20': ROLE_B }, retiredLevelRoles: [ROLE_C],
  });
});

test('setting a threshold retires a replaced role only when no other threshold uses it', () => {
  const replaced = setLevelReward({ '5': ROLE_A, '10': ROLE_A }, [], 5, ROLE_B);
  assert.deepEqual(replaced.levels, { '5': ROLE_B, '10': ROLE_A });
  assert.deepEqual(replaced.retiredLevelRoles, []);
  const retired = setLevelReward({ '5': ROLE_A }, [], 5, ROLE_B);
  assert.deepEqual(retired.retiredLevelRoles, [ROLE_A]);
});

test('removing a threshold keeps its role tracked for cleanup of current members', () => {
  const removed = removeLevelReward({ '5': ROLE_A, '10': ROLE_A }, [ROLE_C], 5);
  assert.equal(removed.removedRoleId, ROLE_A);
  assert.deepEqual(removed.levels, { '10': ROLE_A });
  assert.deepEqual(removed.retiredLevelRoles, [ROLE_C]);
  const fullyRemoved = removeLevelReward({ '5': ROLE_A }, [], 5);
  assert.deepEqual(fullyRemoved.retiredLevelRoles, [ROLE_A]);
});

test('role diff adds earned rewards and removes obsolete managed roles only', () => {
  const diff = levelRoleDiff(7, new Set([ROLE_B, ROLE_C]), { '5': ROLE_A, '10': ROLE_B }, [ROLE_C]);
  assert.deepEqual(diff, { add: [ROLE_A], remove: [ROLE_B, ROLE_C] });
});

test('invalid thresholds and role IDs are rejected', () => {
  assert.throws(() => setLevelReward({}, [], 0, ROLE_A), /1 do 1000/);
  assert.throws(() => setLevelReward({}, [], 5, '@everyone'), /ID roli jest nieprawidłowe/);
  assert.throws(() => normalizeLevelRewards({ '-1': ROLE_A }), /Nieprawidłowy próg/);
});
