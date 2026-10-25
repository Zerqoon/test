import test from 'node:test';
import assert from 'node:assert/strict';
import { selectBackupDeletions } from '../src/backup-policy.js';

const day = 24 * 60 * 60 * 1000;

test('backup retention removes old backups and keeps the newest configured number', () => {
  const list = [
    { file: '/b/old.sqlite', mtimeMs: 0 },
    { file: '/b/new.sqlite', mtimeMs: 9 * day },
    { file: '/b/mid.sqlite', mtimeMs: 8 * day },
  ];
  assert.deepEqual(selectBackupDeletions(list, { now: 10 * day, maxBackups: 2, maxAgeMs: 14 * day }), ['/b/old.sqlite']);
});

test('backup retention never deletes the current backup and enforces both age and count', () => {
  const list = [
    { file: '/b/current.sqlite', mtimeMs: 10 * day },
    { file: '/b/recent.sqlite', mtimeMs: 9 * day },
    { file: '/b/older.sqlite', mtimeMs: 8 * day },
    { file: '/b/ancient.sqlite', mtimeMs: 0 },
  ];
  assert.deepEqual(selectBackupDeletions(list, { now: 10 * day, maxBackups: 2, maxAgeMs: 5 * day, currentFile: '/b/current.sqlite' }), ['/b/older.sqlite', '/b/ancient.sqlite']);
});

test('backup retention ignores malformed entries and sorts without mutating input', () => {
  const list = [{ file: '/b/a.sqlite', mtimeMs: 5 }, null, { file: '/b/b.sqlite', mtimeMs: 8 }, { file: '/b/c.sqlite', mtimeMs: 'bad' }];
  const before = [...list];
  assert.deepEqual(selectBackupDeletions(list, { now: 10, maxBackups: 1, maxAgeMs: 100 }), ['/b/a.sqlite']);
  assert.deepEqual(list, before);
});
