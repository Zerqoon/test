import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { levelForXp } from './level.js';
import { items } from './shop.js';

export class Store {
  constructor(dir) {
    fs.mkdirSync(dir, { recursive: true });
    this.db = new Database(path.join(dir, 'community.sqlite'));
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('foreign_keys = ON');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        guild_id TEXT NOT NULL, user_id TEXT NOT NULL,
        xp INTEGER NOT NULL DEFAULT 0, balance INTEGER NOT NULL DEFAULT 0,
        messages INTEGER NOT NULL DEFAULT 0, voice_seconds INTEGER NOT NULL DEFAULT 0,
        vc_remainder INTEGER NOT NULL DEFAULT 0,
        last_message_at INTEGER NOT NULL DEFAULT 0, last_message_hash TEXT NOT NULL DEFAULT '',
        last_repeat_at INTEGER NOT NULL DEFAULT 0,
        last_daily_at INTEGER NOT NULL DEFAULT 0, last_work_at INTEGER NOT NULL DEFAULT 0,
        booster_until INTEGER NOT NULL DEFAULT 0, title TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (guild_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS inventory (
        guild_id TEXT NOT NULL, user_id TEXT NOT NULL, item_id TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, user_id, item_id)
      );
      CREATE TABLE IF NOT EXISTS warnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, user_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rooms (
        channel_id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, owner_id TEXT NOT NULL,
        panel_id TEXT, created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS message_snapshots (
        message_id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL,
        author_id TEXT NOT NULL, content TEXT NOT NULL, attachment_names TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_top_xp ON users (guild_id, xp DESC, user_id);
      CREATE INDEX IF NOT EXISTS idx_top_balance ON users (guild_id, balance DESC, user_id);
      CREATE INDEX IF NOT EXISTS idx_snapshots_ttl ON message_snapshots (updated_at);
      CREATE INDEX IF NOT EXISTS idx_warnings ON warnings (guild_id, user_id);
    `);
    this.ensure = this.db.prepare('INSERT OR IGNORE INTO users (guild_id,user_id) VALUES (?,?)');
    this.find = this.db.prepare('SELECT * FROM users WHERE guild_id = ? AND user_id = ?');
  }

  close() { this.db.close(); }
  user(guild, user) { this.ensure.run(guild, user); return this.find.get(guild, user); }
  rank(guild, user, field = 'xp') {
    if (!['xp', 'balance'].includes(field)) throw new Error('Invalid ranking field');
    const value = this.user(guild, user)[field];
    return 1 + this.db.prepare(`SELECT COUNT(*) AS n FROM users WHERE guild_id=? AND (${field}>? OR (${field}=? AND user_id<?))`).get(guild, value, value, user).n;
  }
  top(guild, field = 'xp', limit = 10) {
    if (!['xp', 'balance'].includes(field)) throw new Error('Invalid ranking field');
    return this.db.prepare(`SELECT * FROM users WHERE guild_id=? ORDER BY ${field} DESC, user_id ASC LIMIT ?`).all(guild, Math.min(10, Math.max(1, limit)));
  }

  #grantXp(guild, user, amount, kind) {
    const old = this.user(guild, user);
    const xp = Math.max(0, old.xp + amount);
    const from = levelForXp(old.xp), to = levelForXp(xp);
    const bonus = to > from ? Array.from({ length: to - from }, (_, i) => (from + 1 + i) * 75).reduce((a,b) => a+b,0) : 0;
    this.db.prepare(`UPDATE users SET xp=?, balance=balance+?, messages=messages+? WHERE guild_id=? AND user_id=?`)
      .run(xp, bonus, kind === 'message' ? 1 : 0, guild, user);
    return { oldLevel: from, level: to, xp, bonus, gained: xp - old.xp };
  }

  changeXp(guild, user, amount) {
    return this.db.transaction(() => this.#grantXp(guild, user, amount, 'admin'))();
  }
  setXp(guild, user, xp) {
    return this.db.transaction(() => this.#grantXp(guild, user, Math.max(0, xp) - this.user(guild, user).xp, 'admin'))();
  }
  grantMessageXp(guild, user, content, amount, cfg, now = Date.now()) {
    return this.db.transaction(() => {
      const row = this.user(guild, user);
      if (now - row.last_message_at < cfg.messageCooldownMs) return null;
      const digest = crypto.createHash('sha256').update(content.toLowerCase().trim()).digest('hex');
      if (row.last_message_hash === digest && now - row.last_repeat_at < cfg.repeatCooldownMs) return null;
      this.db.prepare('UPDATE users SET last_message_at=?,last_message_hash=?,last_repeat_at=? WHERE guild_id=? AND user_id=?')
        .run(now, digest, now, guild, user);
      return this.#grantXp(guild, user, amount, 'message');
    })();
  }
  grantVoiceTime(guild, user, seconds, amountPerMinute) {
    return this.db.transaction(() => {
      const row = this.user(guild, user);
      const minutes = Math.floor((row.vc_remainder + seconds) / 60);
      this.db.prepare('UPDATE users SET voice_seconds=voice_seconds+?,vc_remainder=? WHERE guild_id=? AND user_id=?')
        .run(seconds, (row.vc_remainder + seconds) % 60, guild, user);
      return minutes ? this.#grantXp(guild, user, minutes * amountPerMinute, 'voice') : null;
    })();
  }

  claim(guild, user, kind, cooldownMs, reward, now = Date.now()) {
    const field = kind === 'daily' ? 'last_daily_at' : kind === 'work' ? 'last_work_at' : null;
    if (!field) throw new Error('Invalid reward');
    return this.db.transaction(() => {
      const row = this.user(guild, user);
      if (now - row[field] < cooldownMs) return { ok: false, availableAt: row[field] + cooldownMs };
      this.db.prepare(`UPDATE users SET ${field}=?, balance=balance+? WHERE guild_id=? AND user_id=?`).run(now, reward, guild, user);
      return { ok: true, balance: row.balance + reward, reward };
    })();
  }
  transfer(guild, from, to, amount) {
    return this.db.transaction(() => {
      if (!Number.isSafeInteger(amount) || amount <= 0 || from === to) return false;
      this.user(guild, from); this.user(guild, to);
      const debit = this.db.prepare('UPDATE users SET balance=balance-? WHERE guild_id=? AND user_id=? AND balance>=?')
        .run(amount, guild, from, amount);
      if (!debit.changes) return false;
      this.db.prepare('UPDATE users SET balance=balance+? WHERE guild_id=? AND user_id=?').run(amount, guild, to);
      return true;
    })();
  }
  wager(guild, user, stake, payout) {
    return this.db.transaction(() => {
      if (!Number.isSafeInteger(stake) || stake <= 0 || !Number.isSafeInteger(payout) || payout < 0) return false;
      this.user(guild, user);
      const debit = this.db.prepare('UPDATE users SET balance=balance-? WHERE guild_id=? AND user_id=? AND balance>=?')
        .run(stake, guild, user, stake);
      if (!debit.changes) return false;
      this.db.prepare('UPDATE users SET balance=balance+? WHERE guild_id=? AND user_id=?').run(payout, guild, user);
      return this.user(guild, user).balance;
    })();
  }
  changeBalance(guild, user, amount) {
    return this.db.transaction(() => {
      const row = this.user(guild, user);
      const next = Math.max(0, row.balance + amount);
      this.db.prepare('UPDATE users SET balance=? WHERE guild_id=? AND user_id=?').run(next, guild, user);
      return next;
    })();
  }
  setBalance(guild, user, amount) { return this.changeBalance(guild, user, Math.max(0, amount) - this.user(guild, user).balance); }
  inventory(guild, user) {
    return this.db.prepare('SELECT item_id,quantity FROM inventory WHERE guild_id=? AND user_id=? AND quantity>0 ORDER BY item_id').all(guild, user);
  }
  buy(guild, user, itemId) {
    const item = items[itemId];
    if (!item) return false;
    return this.db.transaction(() => {
      this.user(guild, user);
      const debit = this.db.prepare('UPDATE users SET balance=balance-? WHERE guild_id=? AND user_id=? AND balance>=?')
        .run(item.price, guild, user, item.price);
      if (!debit.changes) return false;
      this.db.prepare('INSERT INTO inventory (guild_id,user_id,item_id,quantity) VALUES (?,?,?,1) ON CONFLICT (guild_id,user_id,item_id) DO UPDATE SET quantity=quantity+1')
        .run(guild, user, itemId);
      return true;
    })();
  }
  use(guild, user, itemId, now = Date.now()) {
    const item = items[itemId];
    if (!item) return false;
    return this.db.transaction(() => {
      const debit = this.db.prepare('UPDATE inventory SET quantity=quantity-1 WHERE guild_id=? AND user_id=? AND item_id=? AND quantity>0').run(guild, user, itemId);
      if (!debit.changes) return false;
      this.user(guild, user);
      if (itemId === 'xp_boost') {
        this.db.prepare('UPDATE users SET booster_until=MAX(booster_until,?)+3600000 WHERE guild_id=? AND user_id=?')
          .run(now, guild, user);
      } else {
        this.db.prepare('UPDATE users SET title=? WHERE guild_id=? AND user_id=?').run(item.title, guild, user);
      }
      return true;
    })();
  }
  addWarning(guild, user, moderator, reason) {
    return this.db.prepare('INSERT INTO warnings (guild_id,user_id,moderator_id,reason,created_at) VALUES (?,?,?,?,?)')
      .run(guild, user, moderator, reason.slice(0, 400), Date.now()).lastInsertRowid;
  }
  warnings(guild, user) { return this.db.prepare('SELECT * FROM warnings WHERE guild_id=? AND user_id=? ORDER BY id DESC LIMIT 15').all(guild, user); }
  removeWarning(guild, id) { return !!this.db.prepare('DELETE FROM warnings WHERE guild_id=? AND id=?').run(guild, id).changes; }

  room(channelId) { return this.db.prepare('SELECT * FROM rooms WHERE channel_id=?').get(channelId); }
  ownerRoom(guild, user) { return this.db.prepare('SELECT * FROM rooms WHERE guild_id=? AND owner_id=? LIMIT 1').get(guild, user); }
  rooms() { return this.db.prepare('SELECT * FROM rooms').all(); }
  saveRoom(guild, channel, owner, panel = null) {
    this.db.prepare('INSERT INTO rooms (guild_id,channel_id,owner_id,panel_id,created_at) VALUES (?,?,?,?,?)')
      .run(guild, channel, owner, panel, Date.now());
  }
  setPanel(channel, panel) { this.db.prepare('UPDATE rooms SET panel_id=? WHERE channel_id=?').run(panel, channel); }
  setOwner(channel, owner) { this.db.prepare('UPDATE rooms SET owner_id=? WHERE channel_id=?').run(owner, channel); }
  deleteRoom(channel) { this.db.prepare('DELETE FROM rooms WHERE channel_id=?').run(channel); }

  saveMessage(msg) {
    this.db.prepare(`INSERT INTO message_snapshots (message_id,guild_id,channel_id,author_id,content,attachment_names,updated_at)
      VALUES (?,?,?,?,?,?,?) ON CONFLICT(message_id) DO UPDATE SET content=excluded.content,attachment_names=excluded.attachment_names,updated_at=excluded.updated_at`)
      .run(msg.id, msg.guildId, msg.channelId, msg.author.id, (msg.content || '').slice(0, 1800),
        JSON.stringify([...msg.attachments.values()].map(a => a.name).slice(0, 10)), Date.now());
  }
  snapshot(id) { return this.db.prepare('SELECT * FROM message_snapshots WHERE message_id=?').get(id); }
  removeMessage(id) { this.db.prepare('DELETE FROM message_snapshots WHERE message_id=?').run(id); }
  cleanupSnapshots() { return this.db.prepare('DELETE FROM message_snapshots WHERE updated_at<?').run(Date.now() - 7 * 86400000).changes; }
}
