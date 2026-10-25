import test from 'node:test';
import assert from 'node:assert/strict';
import { canOpenAnotherTicket, slugify, suggestionVoteValue } from '../src/community-helpers.js';

test('slugify makes safe, readable Discord channel names from Polish display names', () => {
  assert.equal(slugify('Łukasz Żółć'), 'lukasz-zolc');
  assert.equal(slugify('  WIDMO !!!  '), 'widmo');
  assert.equal(slugify('👻🖤'), 'uzytkownik');
  assert.ok(slugify('a'.repeat(100)).length <= 28);
});

test('ticket limit helper enforces a finite positive per-user limit', () => {
  assert.equal(canOpenAnotherTicket(0, 1), true);
  assert.equal(canOpenAnotherTicket(1, 1), false);
  assert.equal(canOpenAnotherTicket(2, 3), true);
  assert.equal(canOpenAnotherTicket(3, 3), false);
  assert.equal(canOpenAnotherTicket(-1, 1), false);
  assert.equal(canOpenAnotherTicket(0, 0), false);
});

test('suggestion vote mapping only accepts defined directions', () => {
  assert.equal(suggestionVoteValue('up'), 1);
  assert.equal(suggestionVoteValue('down'), -1);
  assert.equal(suggestionVoteValue('other'), null);
});
