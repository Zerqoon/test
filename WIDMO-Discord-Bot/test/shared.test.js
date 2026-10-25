import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { parseDuration, canModerate, staffTier } from '../src/shared.js';
const guild = { ownerId: 'owner' };
const member = (id, role, position) => ({ id, guild, user:{bot:false}, roles:{cache:new Map(role ? [[role,{}]] : []),highest:{position,comparePositionTo(other){return this.position-other.position;}}}});
test('czas wymaga jednostek i respektuje granicę 28 dni', () => {
  assert.equal(parseDuration('1h30m'), 5_400_000);
  assert.equal(parseDuration('28d', {max:28*86400000}),28*86400000);
  for (const input of ['30','-1h','0s','Infinityd','999999999999999999d','1hxyz']) assert.throws(()=>parseDuration(input));
  assert.throws(()=>parseDuration('29d',{max:28*86400000}));
});
test('moderator nie wykonuje akcji administratora; role równorzędne i wyższe są chronione', () => {
  const moderator=member('moderator',config.roles.moderator,5), normal=member('user',null,1), admin=member('admin',config.roles.admin,7);
  assert.equal(canModerate(moderator,normal,1),true);
  assert.equal(canModerate(moderator,normal,2),false);
  assert.equal(canModerate(moderator,admin,1),false);
  assert.equal(canModerate(admin,moderator,2),true);
  assert.equal(canModerate(admin,member('admin2',config.roles.admin,6),2),false);
  assert.equal(canModerate(admin,member('owner',null,1),2),false);
  assert.equal(canModerate(admin,admin,2),false);
  assert.equal(canModerate(admin,member('protected',null,10),2),false);
  assert.equal(staffTier(member('someone',null,1)),0);
});
