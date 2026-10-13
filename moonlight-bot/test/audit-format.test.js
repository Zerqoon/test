import test from 'node:test';
import assert from 'node:assert/strict';
import { AuditLogEvent, PermissionFlagsBits as P } from 'discord.js';
import { auditTitle, auditFields } from '../src/audit-format.js';

const base = { id: '1559306598927704135', executorId: '1488470377993736234', executor: { tag: 'Szef' }, targetType: 'User', targetId: '1516502263944839359', target: { tag: 'Gracz' } };
const all = fields => fields.map(field => `${field.name}\n${field.value}`).join('\n');

test('every known audit event has a Polish title, unknown actions have a friendly fallback', () => {
  for (const action of Object.values(AuditLogEvent).filter(value => typeof value === 'number')) {
    const title = auditTitle({ action });
    assert.ok(title.startsWith('🛡️ '));
    assert.notEqual(title, '🛡️ Zdarzenie w dzienniku serwera', `Missing action ${action}`);
    assert.ok(!title.includes(AuditLogEvent[action]));
  }
  assert.equal(auditTitle({ action: 99999 }), '🛡️ Zdarzenie w dzienniku serwera');
});

test('audit identifies executor and target; nickname changes retain user braces and protect markdown', () => {
  const fields = auditFields({ ...base, reason: 'Powód {bez zmian}', changes: [{ key: 'nick', old: null, new: '**Gracz** {PL}' }] });
  assert.match(all(fields), /Szef\nID: 1488470377993736234/);
  assert.match(all(fields), /Gracz\nID: 1516502263944839359/);
  assert.ok(all(fields).includes('Powód {bez zmian}'));
  assert.ok(fields.find(f => f.name === 'Pseudonim').value.includes('\\*\\*Gracz\\*\\* {PL}'));
  assert.match(fields.find(f => f.name === 'Pseudonim').value, /\*\*Przed:\*\*\nBrak/);
  assert.ok(!all(fields).includes('"key"'));
});

test('role changes and permission bits are human-readable in Polish', () => {
  const fields = auditFields({ ...base, changes: [
    { key: '$add', new: [{ name: 'Weteran', id: '1517165022151704626' }] },
    { key: '$remove', new: [{ name: 'Nowy', id: '1517118754037698631' }] },
    { key: 'permissions', old: '0', new: String(P.ManageRoles | P.SendMessages) },
    { key: 'allow', old: '0', new: String(P.ViewChannel) },
    { key: 'deny', old: '0', new: String(P.Connect) },
  ] });
  assert.match(fields.find(f => f.name === 'Nadane role').value, /Weteran · ID: 1517165022151704626/);
  assert.match(fields.find(f => f.name === 'Odebrane role').value, /Nowy/);
  assert.match(fields.find(f => f.name === 'Uprawnienia').value, /Zarządzanie rolami/);
  assert.match(fields.find(f => f.name === 'Uprawnienia').value, /Wysyłanie wiadomości/);
  assert.match(fields.find(f => f.name === 'Zezwolono').value, /Wyświetlanie kanału/);
  assert.match(fields.find(f => f.name === 'Zabroniono').value, /Łączenie z voice/);
  assert.ok(!all(fields).includes('[object Object]'));
});

test('overwrites, channel type, booleans, timeout and audit extra have readable values', () => {
  const fields = auditFields({ ...base, targetType: 'Channel', changes: [
    { key: 'type', old: 0, new: 2 }, { key: 'nsfw', old: false, new: true },
    { key: 'communication_disabled_until', old: null, new: '2026-10-13T12:00:00Z' },
    { key: 'permission_overwrites', old: [], new: [{ id: '1516502263944839359', type: 0, allow: String(P.SendMessages), deny: String(P.Connect) }] },
  ], extra: { channel: { id: '1517117542223839353' }, count: 3, messageId: '1559306598927704135' } });
  assert.match(fields.find(f => f.name === 'Typ').value, /Tekstowy[\s\S]+Głosowy/);
  assert.match(fields.find(f => f.name === 'Kanał dla dorosłych').value, /Nie[\s\S]+Tak/);
  assert.match(fields.find(f => f.name === 'Timeout do').value, /<t:\d+:F>/);
  assert.match(fields.find(f => f.name === 'Uprawnienia kanału').value, /Rola · ID:[\s\S]+Zezwolono:[\s\S]+Wysyłanie wiadomości[\s\S]+Zabroniono:/);
  assert.equal(fields.find(f => f.name === 'Kanał').value, '<#1517117542223839353> · ID: 1517117542223839353');
  assert.equal(fields.find(f => f.name === 'Liczba').value, '3');
});

test('unknown structured data, null values and absent targets never produce raw objects', () => {
  const cyclic = { nested: { foo: ['wartość', null] } }; cyclic.self = cyclic;
  const fields = auditFields({ changes: [{ key: 'future_property', new: cyclic }, { key: 'name', old: '', new: null }], extra: null });
  assert.ok(!all(fields).includes('[object Object]'));
  assert.ok(!all(fields).includes('future_property'));
  assert.ok(!all(fields).includes('{'));
  assert.match(all(fields), /wartość/);
  assert.match(all(fields), /Powiązana informacja/);
  assert.match(all(fields), /Discord nie podał wykonawcy/);
  assert.match(all(fields), /Brak/);
  assert.doesNotThrow(() => auditFields());
});

test('long Unicode audit values split into bounded fields without losing content or breaking emoji', () => {
  const before = '🌙'.repeat(3000);
  const after = 'Żółć '.repeat(1500);
  const fields = auditFields({ ...base, changes: [{ key: 'topic', old: before, new: after }] });
  const parts = fields.filter(f => f.name.startsWith('Temat kanału'));
  assert.ok(parts.length > 10);
  assert.equal(parts.map(f => f.value).join(''), `**Przed:**\n${before}\n\n**Po:**\n${after}`);
  for (const field of fields) {
    assert.ok(field.value.length <= 1024);
    assert.ok(field.value.isWellFormed());
    assert.ok(field.name.length <= 256);
  }
});

test('overwrite type means role or member and message deletion identifies its author', () => {
  const fields = auditFields({ ...base, targetType: 'Channel', action: AuditLogEvent.ChannelOverwriteCreate, changes: [{key:'type',new:0}] });
  assert.match(fields.find(f=>f.name==='Typ').value,/Rola/);
  assert.doesNotMatch(fields.find(f=>f.name==='Typ').value,/Tekstowy/);
  const deletion = auditFields({ ...base, target: null, targetType: 'Message', action: AuditLogEvent.MessageDelete });
  assert.match(deletion.find(f=>f.name==='Cel · ID').value,/Autor wiadomości/);
});
