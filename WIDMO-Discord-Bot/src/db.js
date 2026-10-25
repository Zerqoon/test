import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

if (config.databasePath !== ':memory:') mkdirSync(path.dirname(config.databasePath), { recursive: true });
export const db = new DatabaseSync(config.databasePath);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  -- The ticket index is shared by community flows and AutoMod; initialize it centrally so
  -- either module can be imported/tested safely without relying on ESM import order.
  CREATE TABLE IF NOT EXISTS widmo_tickets (
    channel_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    opener_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    ticket_type TEXT NOT NULL DEFAULT 'general',
    claimed_by TEXT,
    claimed_at INTEGER,
    closed_at INTEGER,
    closed_by TEXT,
    status TEXT NOT NULL DEFAULT 'open'
  );
  CREATE INDEX IF NOT EXISTS widmo_tickets_active ON widmo_tickets(guild_id, opener_id, status);
`);

export function getSetting(key) { return db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value; }
export function setSetting(key, value) {
  db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value));
}
