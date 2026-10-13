import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

process.env.DATABASE_PATH = ':memory:';
process.env.GUILD_ID = '123456789012345678';
const { config } = await import('../src/config.js');
const { db } = await import('../src/db.js');
const { installVoice, handleVoiceInteraction } = await import('../src/voice.js');
const { ChannelType, Events } = await import('discord.js');

const channelId = '223456789012345678';
const ownerId = '323456789012345678';
const visitorId = '423456789012345678';
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture() {
  db.exec('DELETE FROM temporary_voice; DELETE FROM voice_creation_intents;');
  const client = new EventEmitter();
  client.user = { id: '523456789012345678' };
  client.isReady = () => false;
  const deleted = [];
  const channels = new Map();
  const guild = {
    id: config.guildId, ownerId: '623456789012345678', client,
    channels: { fetch: async id => id ? channels.get(id) ?? null : channels },
    roles: { cache: new Map() },
    members: { me: { id: client.user.id }, fetch: async () => member },
  };
  client.guilds = { cache: new Map([[guild.id, guild]]) };
  const member = { id: ownerId, user: { bot: false }, guild, voice: { channelId }, roles: { cache: new Map(), highest: { position: 1 } } };
  const channel = { id: channelId, guild, name: 'room', type: ChannelType.GuildVoice, userLimit: 0, members: new Map(), permissionsFor: () => ({ has: () => true }), delete: async () => { deleted.push(channelId); channels.delete(channelId); } };
  channels.set(channelId, channel);
  function store(owner = ownerId) {
    db.prepare('INSERT INTO temporary_voice(channel_id,guild_id,owner_id,base_overwrites,created_at) VALUES(?,?,?,?,?)').run(channelId, guild.id, owner, '[]', Date.now() - 60000);
  }
  return { client, guild, member, channel, channels, deleted, store };
}

function interaction(f, action) {
  const responses = [];
  return {
    customId: `voice:${action}:${channelId}`, guildId: f.guild.id, guild: f.guild, client: f.client,
    user: { id: ownerId }, inGuild: () => true,
    fields: { getTextInputValue: () => '20' },
    deferReply: async function () { this.deferred = true; },
    editReply: async payload => { responses.push(payload); }, responses,
  };
}

test('startup waits for ready, then removes tracked empty channels and preserves unrelated ones', async () => {
  const f = fixture();
  f.store();
  let unrelatedDeleted = false;
  f.channels.set('723456789012345678', { id: '723456789012345678', type: ChannelType.GuildVoice, members: new Map(), delete: async () => { unrelatedDeleted = true; } });
  const service = installVoice(f.client);
  try {
    await tick();
    assert.deepEqual(f.deleted, []);
    f.client.isReady = () => true;
    f.client.emit(Events.ClientReady);
    for (let i = 0; i < 10; i++) await tick();
    assert.deepEqual(f.deleted, [channelId]);
    assert.equal(unrelatedDeleted, false);
    assert.equal(db.prepare('SELECT count(*) AS count FROM temporary_voice').get().count, 0);
  } finally { service.stop(); }
});

test('an apparently empty new channel survives REST/gateway propagation delay', async () => {
  const f = fixture();
  f.store();
  db.prepare('UPDATE temporary_voice SET created_at=? WHERE channel_id=?').run(Date.now(), channelId);
  f.client.isReady = () => true;
  const service = installVoice(f.client);
  try {
    for (let i = 0; i < 10; i++) await tick();
    assert.deepEqual(f.deleted, []);
    assert.ok(db.prepare('SELECT channel_id FROM temporary_voice WHERE channel_id=?').get(channelId));
  } finally { service.stop(); }
});

test('restart recovers the exact pending creation journal entry and cleans it when empty', async () => {
  const f = fixture();
  const marker = 'moonlight-pending-unique-test-marker';
  const timestamp = Date.now() - 60000;
  Object.assign(f.channel, { name: marker, parentId: null, createdTimestamp: timestamp + 500, permissionOverwrites: { cache: new Map([[f.client.user.id, {}]]) } });
  f.channels.find = predicate => [...f.channels.values()].find(predicate);
  db.prepare('INSERT INTO voice_creation_intents VALUES (?,?,?,?,?,?)').run(marker, f.guild.id, ownerId, null, '[]', timestamp);
  f.client.isReady = () => true;
  const service = installVoice(f.client);
  try {
    for (let i = 0; i < 10; i++) await tick();
    assert.deepEqual(f.deleted, [channelId]);
    assert.equal(db.prepare('SELECT count(*) AS count FROM voice_creation_intents').get().count, 0);
    assert.equal(db.prepare('SELECT count(*) AS count FROM temporary_voice').get().count, 0);
  } finally { service.stop(); }
});

test('stale modal is reauthorized against the current database owner, without changing channel settings', async t => {
  t.mock.method(console, 'error', () => {});
  const f = fixture();
  f.store(visitorId); // The room was transferred after this former owner opened a modal.
  let mutated = false;
  f.channel.setUserLimit = async () => { mutated = true; };
  const i = interaction(f, 'limit_submit');
  assert.equal(await handleVoiceInteraction(i), true);
  assert.equal(mutated, false);
  assert.match(i.responses.at(-1).content, /Tylko właściciel/);
});

test('delete confirmation rechecks occupancy and refuses disconnecting other members', async t => {
  t.mock.method(console, 'error', () => {});
  const f = fixture();
  f.store();
  f.channel.members.set(ownerId, f.member);
  f.channel.members.set(visitorId, { id: visitorId });
  const i = interaction(f, 'delete_confirm');
  await handleVoiceInteraction(i);
  assert.deepEqual(f.deleted, []);
  assert.match(i.responses.at(-1).content, /inne osoby/);
  assert.ok(db.prepare('SELECT channel_id FROM temporary_voice WHERE channel_id=?').get(channelId));
});

test('someone outside the voice cannot claim an abandoned room', async t => {
  t.mock.method(console, 'error', () => {});
  const f = fixture();
  f.store(visitorId);
  f.member.voice.channelId = '823456789012345678';
  const i = interaction(f, 'claim');
  await handleVoiceInteraction(i);
  assert.match(i.responses.at(-1).content, /gdy jesteś na nim/);
  assert.equal(db.prepare('SELECT owner_id FROM temporary_voice WHERE channel_id=?').get(channelId).owner_id, visitorId);
});

test('a panel copied or referenced on a different guild is rejected before channel access', async t => {
  t.mock.method(console, 'error', () => {});
  const f = fixture();
  f.store();
  const i = interaction(f, 'lock');
  i.guildId = '923456789012345678';
  let fetched = false;
  f.guild.channels.fetch = async () => { fetched = true; };
  await handleVoiceInteraction(i);
  assert.equal(fetched, false);
  assert.match(i.responses.at(-1).content, /skonfigurowanym serwerze/);
});
