import test from 'node:test';
import assert from 'node:assert/strict';
import { canOpenAnotherTicket, normalizeTicketType, slugify, suggestionVoteValue, TICKET_TYPES } from '../src/community-helpers.js';

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

test('ticket types include the three supported categories with safe names and clear instructions', () => {
  assert.equal(normalizeTicketType('clan'), 'clan');
  assert.equal(normalizeTicketType('general'), 'general');
  assert.equal(normalizeTicketType('reward'), 'reward');
  assert.equal(normalizeTicketType('unknown'), 'general');
  assert.equal(TICKET_TYPES.reward.label, 'Odbiór nagrody');
  assert.equal(TICKET_TYPES.reward.prefix, 'odbior-nagrody');
  assert.match(TICKET_TYPES.reward.description, /dowód wygranej/);
  assert.match(TICKET_TYPES.reward.description, /Nie wysyłaj haseł/);
});
