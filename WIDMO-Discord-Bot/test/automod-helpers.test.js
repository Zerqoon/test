import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedHostname, assessMessage, containsDiscordInvite, extractLinks } from '../src/automod-helpers.js';

const settings = { imageMinLevel: 5, linkMinLevel: 10, allowedDomains: ['youtube.com', 'youtu.be', 'roblox.com', 'tenor.com', 'giphy.com', 'gph.is', 'tiktok.com', 'clips.twitch.tv', 'medal.tv'] };
const assess = (content, options = {}) => assessMessage({ content, ...options }, settings);

test('Discord invites are blocked including common obfuscations and encoded redirects for veterans', () => {
  for (const content of [
    'https://discord.gg/abcdef', 'DISCORD.GG/abcdef', 'discord.com/invite/abcdef',
    'https://discordapp.com/invite/test', 'd i s c o r d . g g / code',
    'discord[.]gg/code', 'discord (dot) gg/code', 'discord kropka gg/code',
    'd\u200Biscord.gg/test', 'https://discord%2egg/test',
    'https://discord%252egg/test', 'https://d%E2%80%8Biscord.gg/test',
    'https://youtube.com/redirect?q=https%3A%2F%2Fdiscord.gg%2Fcode',
    '[klik](https://discord.gg/test)', 'ｄｉｓｃｏｒｄ．ｇｇ/code',
    'discord.com\\invite\\abcdef', 'discord&#46;gg&#47;code',
    'https://discord.com/api/v10/invites/code', 'discord.com/servers/example-server',
  ]) {
    assert.equal(containsDiscordInvite(content), true, content);
    assert.equal(assess(content, { veteran: true, level: 50 }).allowed, false, content);
  }
  assert.equal(containsDiscordInvite('Dokumentacja https://discord.com/developers/docs'), false);
});

test('exact hostname allowlist rejects suffix and credential tricks and permits real subdomains', () => {
  assert.equal(allowedHostname('m.youtube.com', settings.allowedDomains), true);
  assert.equal(allowedHostname('youtube.com.evil.test', settings.allowedDomains), false);
  assert.equal(allowedHostname('notyoutube.com', settings.allowedDomains), false);
  for (const content of ['https://youtube.com.evil.test/a', 'https://youtube.com@evil.test/a', 'https://notyoutube.com/a', 'https://yоutube.com/a', 'https://evil.test/?next=youtube.com', 'ftp://youtube.com/file']) {
    assert.equal(assess(content, { level: 10 }).allowed, false, content);
  }
  for (const content of ['https://m.youtube.com/watch?v=123', '<https://roblox.com/games/123>', '[film](https://youtu.be/abc)', 'tenor.com/view/abc', 'https://clips.twitch.tv/abc', 'https://medal.tv/games/roblox/clips/123']) {
    assert.equal(assess(content, { level: 10 }).allowed, true, content);
  }
});

test('photos and stickers require level five; all direct links including GIFs require ten', () => {
  assert.equal(assess('Cześć wszystkim').allowed, true);
  assert.equal(assess('', { hasAttachments: true, level: 4 }).allowed, false);
  assert.equal(assess('', { hasAttachments: true, level: 5 }).allowed, true);
  assert.equal(assess('', { hasStickers: true, level: 4 }).allowed, false);
  assert.equal(assess('', { hasStickers: true, level: 5 }).allowed, true);
  assert.equal(assess('https://tenor.com/view/abc', { level: 5 }).allowed, false);
  assert.equal(assess('https://youtube.com', { level: 9 }).allowed, false);
  assert.equal(assess('https://youtube.com', { level: 10 }).allowed, true);
  assert.equal(assess('https://example.org', { level: 50 }).allowed, false);
  assert.equal(assess('https://example.org', { veteran: true }).allowed, true);
  assert.equal(assess('', { veteran: true, hasAttachments: true }).allowed, true);
});

test('attachments are allowed in tickets for new members, while ordinary channels retain the media-level gate', () => {
  assert.equal(assess('', { hasAttachments: true, level: 0 }).allowed, false);
  assert.equal(assess('', { hasAttachments: true, allowAttachments: true, level: 0 }).allowed, true);
  assert.equal(assess('', { hasStickers: true, allowAttachments: true, level: 0 }).allowed, false);
  assert.equal(assess('https://discord.gg/example', { hasAttachments: true, allowAttachments: true, level: 0 }).allowed, false);
});

test('all links in a message and existing embed destinations are checked', () => {
  assert.equal(assess('https://youtube.com/watch?v=123 and https://evil.test', { level: 10 }).allowed, false);
  assert.equal(assess('Oto film', { level: 10, linkTexts: ['https://evil.test'] }).allowed, false);
  assert.equal(assess('http://127.0.0.1', { level: 10 }).allowed, false);
  assert.equal(assess('127.0.0.1/test', { level: 0 }).allowed, false);
  assert.equal(assess('http://[::1]/', { level: 10 }).allowed, false);
  assert.ok(extractLinks('https://youtube.com@evil.test').some((link) => link.hostname === 'evil.test'));
  assert.equal(assess('https%3A%2F%2Fevil.test', { level: 10 }).allowed, false);
});
