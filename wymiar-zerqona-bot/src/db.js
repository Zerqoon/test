import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { levelForXp } from './level.js';
import { items, permanent } from './shop.js';
import { achievements } from './achievements.js';
import { config } from './config.js';

const fields = new Set(['xp', 'balance', 'messages', 'voice_seconds', 'bank', 'wealth']);
const fieldSQL = field => field === 'wealth' ? '(balance+bank)' : field;
const MAX_VALUE = 1_000_000_000_000;
function integer(n, min = 0) {
  if (!Number.isSafeInteger(n) || n < min || n > MAX_VALUE) throw new RangeError('Kwota lub XP poza dozwolonym zakresem.');
  return n;
}

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
      CREATE TABLE IF NOT EXISTS economy_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, user_id TEXT NOT NULL,
        kind TEXT NOT NULL, amount INTEGER NOT NULL, balance_after INTEGER NOT NULL,
        details TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_history ON economy_history (guild_id,user_id,id DESC);
      CREATE TABLE IF NOT EXISTS achievement_claims (
        guild_id TEXT NOT NULL,user_id TEXT NOT NULL,achievement_id TEXT NOT NULL,claimed_at INTEGER NOT NULL,
        PRIMARY KEY(guild_id,user_id,achievement_id)
      );
      CREATE TABLE IF NOT EXISTS channel_locks (
        channel_id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, previous_send INTEGER, created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_top_xp ON users (guild_id, xp DESC, user_id);
      CREATE INDEX IF NOT EXISTS idx_top_balance ON users (guild_id, balance DESC, user_id);
      CREATE INDEX IF NOT EXISTS idx_snapshots_ttl ON message_snapshots (updated_at);
      CREATE INDEX IF NOT EXISTS idx_warnings ON warnings (guild_id, user_id);
    `);
    // Additive migration: keep the existing community.sqlite and all user data.
    const columns = new Set(this.db.prepare('PRAGMA table_info(users)').all().map(c => c.name));
    for (const [name,definition] of Object.entries({
      bank:'INTEGER NOT NULL DEFAULT 0',last_weekly_at:'INTEGER NOT NULL DEFAULT 0',
      xp_multiplier:'REAL NOT NULL DEFAULT 1.5',work_multiplier:'REAL NOT NULL DEFAULT 1.5',
      work_boost_until:'INTEGER NOT NULL DEFAULT 0',card_theme:"TEXT NOT NULL DEFAULT 'default'",
      avatar_frame:"TEXT NOT NULL DEFAULT 'default'",best_daily_streak:'INTEGER NOT NULL DEFAULT 0',
    })) if (!columns.has(name)) this.db.exec(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
    if (!columns.has('daily_streak')) this.db.exec('ALTER TABLE users ADD COLUMN daily_streak INTEGER NOT NULL DEFAULT 0');
    if (!columns.has('rewarded_level')) {
      this.db.exec('ALTER TABLE users ADD COLUMN rewarded_level INTEGER NOT NULL DEFAULT 0');
      const mark = this.db.prepare('UPDATE users SET rewarded_level=? WHERE guild_id=? AND user_id=?');
      this.db.transaction(() => {
        for (const row of this.db.prepare('SELECT guild_id,user_id,xp FROM users').all()) mark.run(levelForXp(row.xp), row.guild_id, row.user_id);
      })();
    }
    this.db.transaction(() => {
      for (const [id, item] of Object.entries(items)) {
        if (item.type !== 'title') continue;
        this.db.prepare('INSERT OR IGNORE INTO inventory (guild_id,user_id,item_id,quantity) SELECT guild_id,user_id,?,1 FROM users WHERE title=?').run(id, item.title);
        this.db.prepare('UPDATE inventory SET quantity=1 WHERE item_id=? AND (quantity>1 OR EXISTS (SELECT 1 FROM users u WHERE u.guild_id=inventory.guild_id AND u.user_id=inventory.user_id AND u.title=?))').run(id, item.title);
      }
    })();
    this.db.exec(`UPDATE users SET best_daily_streak=MAX(best_daily_streak,daily_streak);
      CREATE INDEX IF NOT EXISTS idx_top_wealth ON users(guild_id,(balance+bank) DESC,user_id);
      CREATE INDEX IF NOT EXISTS idx_top_bank ON users(guild_id,bank DESC,user_id);
      CREATE INDEX IF NOT EXISTS idx_top_messages ON users(guild_id,messages DESC,user_id);
      CREATE INDEX IF NOT EXISTS idx_top_voice ON users(guild_id,voice_seconds DESC,user_id);
      CREATE INDEX IF NOT EXISTS idx_economy_date ON economy_history(guild_id,user_id,created_at);
    `);
    this.ensure = this.db.prepare('INSERT OR IGNORE INTO users (guild_id,user_id) VALUES (?,?)');
    this.find = this.db.prepare('SELECT * FROM users WHERE guild_id = ? AND user_id = ?');
  }

  close() { this.db.close(); }
  user(guild, user) { this.ensure.run(guild, user); return this.find.get(guild, user); }
  rank(guild, user, field = 'xp') {
    if (!fields.has(field)) throw new Error('Invalid ranking field');
    const row = this.user(guild, user), value = field === 'wealth' ? row.balance+row.bank : row[field];
    field=fieldSQL(field);
    return 1 + this.db.prepare(`SELECT COUNT(*) AS n FROM users WHERE guild_id=? AND (${field}>? OR (${field}=? AND user_id<?))`).get(guild, value, value, user).n;
  }
  userCount(guild) { return this.db.prepare('SELECT COUNT(*) AS n FROM users WHERE guild_id=?').get(guild).n; }
  top(guild, field = 'xp', limit = 10, offset = 0) {
    if (!fields.has(field)) throw new Error('Invalid ranking field');
    integer(limit, 1); integer(offset);field=fieldSQL(field);
    return this.db.prepare(`SELECT * FROM users WHERE guild_id=? ORDER BY ${field} DESC, user_id ASC LIMIT ? OFFSET ?`).all(guild, Math.min(10, limit), offset);
  }
  #record(guild, user, kind, amount, details = '', now = Date.now()) {
    this.db.prepare('INSERT INTO economy_history (guild_id,user_id,kind,amount,balance_after,details,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(guild, user, kind, amount, this.user(guild, user).balance, details, now);
  }
  history(guild, user, limit = 10) {
    return this.db.prepare('SELECT * FROM economy_history WHERE guild_id=? AND user_id=? ORDER BY id DESC LIMIT ?').all(guild, user, Math.min(15, Math.max(1, limit)));
  }
  #grantXp(guild, user, amount, kind) {
    const old = this.user(guild, user);
    const xp = integer(Math.max(0, old.xp + amount));
    const from = levelForXp(old.xp), to = levelForXp(xp);
    const last = old.rewarded_level;
    const bonus = kind !== 'admin' && to > last ? 75 * (to * (to + 1) - last * (last + 1)) / 2 : 0;
    integer(old.balance + old.bank + bonus);
    this.db.prepare('UPDATE users SET xp=?, balance=balance+?, messages=messages+?, rewarded_level=MAX(rewarded_level,?) WHERE guild_id=? AND user_id=?')
      .run(xp, bonus, kind === 'message' ? 1 : 0, to, guild, user);
    if (bonus) this.#record(guild, user, 'level', bonus, `Poziom ${to}`);
    return { oldLevel: from, level: to, xp, bonus, gained: xp - old.xp };
  }
  changeXp(guild, user, amount) {
    integer(Math.abs(amount));
    return this.db.transaction(() => this.#grantXp(guild, user, amount, 'admin'))();
  }
  setXp(guild, user, xp) {
    integer(xp);
    return this.db.transaction(() => this.#grantXp(guild, user, xp - this.user(guild, user).xp, 'admin'))();
  }
  grantMessageXp(guild, user, content, amount, cfg, now = Date.now()) {
    integer(amount);
    return this.db.transaction(() => {
      const row = this.user(guild, user);
      if (row.last_message_at && now - row.last_message_at < cfg.messageCooldownMs) return null;
      const digest = crypto.createHash('sha256').update(content.toLowerCase().trim().replace(/\s+/g, ' ')).digest('hex');
      if (row.last_message_hash === digest && now - row.last_repeat_at < cfg.repeatCooldownMs) return null;
      this.db.prepare('UPDATE users SET last_message_at=?,last_message_hash=?,last_repeat_at=? WHERE guild_id=? AND user_id=?')
        .run(now, digest, now, guild, user);
      return this.#grantXp(guild, user, amount, 'message');
    })();
  }
  grantVoiceTime(guild, user, seconds, amountPerMinute) {
    integer(seconds); integer(amountPerMinute);
    return this.db.transaction(() => {
      const row = this.user(guild, user);
      const minutes = Math.floor((row.vc_remainder + seconds) / 60);
      this.db.prepare('UPDATE users SET voice_seconds=voice_seconds+?,vc_remainder=? WHERE guild_id=? AND user_id=?')
        .run(seconds, (row.vc_remainder + seconds) % 60, guild, user);
      return minutes ? this.#grantXp(guild, user, minutes * amountPerMinute, 'voice') : null;
    })();
  }
  claim(guild, user, kind, cooldownMs, reward, now = Date.now()) {
    const field = kind === 'daily' ? 'last_daily_at' : kind === 'work' ? 'last_work_at' : kind === 'weekly' ? 'last_weekly_at' : null;
    if (!field) throw new Error('Invalid reward');
    integer(reward); integer(cooldownMs, 1);
    return this.db.transaction(() => {
      const row = this.user(guild, user);
      if (row[field] && now - row[field] < cooldownMs) return { ok: false, availableAt: row[field] + cooldownMs };
      const streak = kind === 'daily' ? (row.last_daily_at && now - row.last_daily_at <= config.economy.dailyGraceMs ? row.daily_streak + 1 : 1) : row.daily_streak;
      const payout = kind === 'work' && row.work_boost_until > now ? Math.floor(reward * row.work_multiplier) : reward;
      const total = payout + (kind === 'daily' ? (Math.min(streak, config.economy.dailyStreakCap) - 1) * config.economy.dailyStreakStep : 0);
      integer(row.balance + row.bank + total);
      this.db.prepare(`UPDATE users SET ${field}=?, balance=balance+?, daily_streak=?,best_daily_streak=MAX(best_daily_streak,?) WHERE guild_id=? AND user_id=?`).run(now, total, streak, streak, guild, user);
      this.#record(guild, user, kind, total, kind === 'daily' ? `Seria: ${streak}` : '', now);
      return { ok: true, balance: row.balance + total, reward: total, streak, availableAt: now + cooldownMs };
    })();
  }
  transfer(guild, from, to, amount) {
    return this.db.transaction(() => {
      if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_VALUE || from === to) return false;
      const sender = this.user(guild, from), recipient = this.user(guild, to);
      if (sender.balance < amount) return false;
      integer(recipient.balance + recipient.bank + amount);
      this.db.prepare('UPDATE users SET balance=balance-? WHERE guild_id=? AND user_id=?').run(amount, guild, from);
      this.db.prepare('UPDATE users SET balance=balance+? WHERE guild_id=? AND user_id=?').run(amount, guild, to);
      this.#record(guild, from, 'transfer_out', -amount, to);
      this.#record(guild, to, 'transfer_in', amount, from);
      return true;
    })();
  }
  wager(guild, user, stake, payout) {
    return this.db.transaction(() => {
      if (!Number.isSafeInteger(stake) || stake <= 0 || !Number.isSafeInteger(payout) || payout < 0) return false;
      const row = this.user(guild, user);
      if (row.balance < stake) return false;
      const next = integer(row.balance - stake + payout);integer(next+row.bank);
      this.db.prepare('UPDATE users SET balance=? WHERE guild_id=? AND user_id=?').run(next, guild, user);
      this.#record(guild, user, 'game', payout - stake, `Stawka ${stake}; wypłata ${payout}`);
      return next;
    })();
  }
  changeBalance(guild, user, amount) {
    integer(Math.abs(amount));
    return this.db.transaction(() => {
      const row = this.user(guild, user), next = integer(Math.max(0, row.balance + amount));integer(next+row.bank);
      this.db.prepare('UPDATE users SET balance=? WHERE guild_id=? AND user_id=?').run(next, guild, user);
      this.#record(guild, user, 'admin', next - row.balance);
      return next;
    })();
  }
  setBalance(guild, user, amount) { integer(amount); return this.changeBalance(guild, user, amount - this.user(guild, user).balance); }
  inventory(guild, user) {
    return this.db.prepare('SELECT item_id,quantity FROM inventory WHERE guild_id=? AND user_id=? AND quantity>0 ORDER BY item_id').all(guild, user);
  }
  owns(guild, user, itemId) {
    return Boolean(this.db.prepare('SELECT 1 FROM inventory WHERE guild_id=? AND user_id=? AND item_id=? AND quantity>0').get(guild, user, itemId));
  }
  buy(guild, user, itemId) {
    const item = Object.hasOwn(items, itemId) && items[itemId];
    if (!item) return false;
    return this.db.transaction(() => {
      this.user(guild, user);
      if (permanent(item) && this.owns(guild, user, itemId)) return false;
      const debit = this.db.prepare('UPDATE users SET balance=balance-? WHERE guild_id=? AND user_id=? AND balance>=?').run(item.price, guild, user, item.price);
      if (!debit.changes) return false;
      this.db.prepare('INSERT INTO inventory (guild_id,user_id,item_id,quantity) VALUES (?,?,?,1) ON CONFLICT (guild_id,user_id,item_id) DO UPDATE SET quantity=quantity+1').run(guild, user, itemId);
      this.#record(guild, user, 'purchase', -item.price, item.name);
      return true;
    })();
  }
  use(guild, user, itemId, now = Date.now()) {
    const item = Object.hasOwn(items, itemId) && items[itemId];
    if (!item) return false;
    return this.db.transaction(() => {
      if (!this.owns(guild, user, itemId)) return false;
      this.user(guild, user);
      const row=this.user(guild,user);
      if (item.type === 'consumable') {
        const until=item.effect==='xp'?'booster_until':'work_boost_until';
        const multiplier=item.effect==='xp'?'xp_multiplier':'work_multiplier';
        if(row[until]>now && row[multiplier]!==item.multiplier)return false;
        this.db.prepare('UPDATE inventory SET quantity=quantity-1 WHERE guild_id=? AND user_id=? AND item_id=?').run(guild,user,itemId);
        this.db.prepare(`UPDATE users SET ${until}=MAX(${until},?)+?,${multiplier}=? WHERE guild_id=? AND user_id=?`).run(now,item.durationMs,item.multiplier,guild,user);
      } else {
        const field={title:'title',theme:'card_theme',frame:'avatar_frame'}[item.type];
        const value=item.title||item.theme||item.frame;
        this.db.prepare(`UPDATE users SET ${field}=? WHERE guild_id=? AND user_id=?`).run(value,guild,user);
      }
      return true;
    })();
  }
  clearTitle(guild, user) {
    this.user(guild, user);
    this.db.prepare("UPDATE users SET title='' WHERE guild_id=? AND user_id=?").run(guild, user);
  }
  resetAppearance(guild,user) {
    this.user(guild,user);
    this.db.prepare("UPDATE users SET card_theme='default',avatar_frame='default' WHERE guild_id=? AND user_id=?").run(guild,user);
  }
  bankMove(guild,user,direction,amount) {
    integer(amount,1);
    if(!['deposit','withdraw'].includes(direction))throw new Error('Invalid bank action');
    return this.db.transaction(()=>{
      const row=this.user(guild,user),source=direction==='deposit'?'balance':'bank',target=direction==='deposit'?'bank':'balance';
      if(row[source]<amount)return {ok:false,available:row[source]};
      this.db.prepare(`UPDATE users SET ${source}=${source}-?,${target}=${target}+? WHERE guild_id=? AND user_id=?`).run(amount,amount,guild,user);
      this.#record(guild,user,direction==='deposit'?'bank_deposit':'bank_withdraw',direction==='deposit'?-amount:amount,`Bank: ${this.user(guild,user).bank}`);
      return {ok:true,...this.user(guild,user)};
    })();
  }
  stats(guild,user,now=Date.now()) {
    const totals=this.db.prepare(`SELECT COUNT(*) AS transactions,
      COALESCE(SUM(CASE WHEN kind IN ('daily','work','weekly','level','achievement') THEN MAX(0,amount) ELSE 0 END),0) AS earned,
      COALESCE(SUM(CASE WHEN kind='purchase' THEN -amount ELSE 0 END),0) AS spent,
      COALESCE(SUM(CASE WHEN kind='work' THEN 1 ELSE 0 END),0) AS works,
      COALESCE(SUM(CASE WHEN kind='game' THEN amount ELSE 0 END),0) AS games
      FROM economy_history WHERE guild_id=? AND user_id=?`).get(guild,user);
    const start=new Date(now);start.setUTCHours(0,0,0,0);start.setUTCDate(start.getUTCDate()-6);
    const grouped=this.db.prepare(`SELECT strftime('%Y-%m-%d',created_at/1000,'unixepoch') AS date,
      SUM(MAX(0,amount)) AS income,SUM(MAX(0,-amount)) AS expense FROM economy_history
      WHERE guild_id=? AND user_id=? AND created_at>=? AND created_at<=? GROUP BY date`).all(guild,user,start.getTime(),now);
    const days=Array.from({length:7},(_,n)=>{
      const date=new Date(start.getTime()+n*86400000).toISOString().slice(0,10),row=grouped.find(d=>d.date===date);
      return {date,label:date.slice(5).split('-').reverse().join('.'),income:row?.income||0,expense:row?.expense||0};
    });
    return {...totals,days};
  }
  achievementStatus(guild,user) {
    const row=this.user(guild,user),inventory=this.inventory(guild,user);
    const claimed=new Set(this.db.prepare('SELECT achievement_id FROM achievement_claims WHERE guild_id=? AND user_id=?').all(guild,user).map(r=>r.achievement_id));
    const works=this.db.prepare("SELECT COUNT(*) AS n FROM economy_history WHERE guild_id=? AND user_id=? AND kind='work'").get(guild,user).n;
    const metrics={level:levelForXp(row.xp),messages:row.messages,voice_minutes:Math.floor(row.voice_seconds/60),daily_streak:row.best_daily_streak,bank:row.bank,collection:inventory.filter(r=>permanent(items[r.item_id])).length,works};
    return achievements.map(a=>({...a,progress:Math.min(a.goal,metrics[a.metric]||0),claimed:claimed.has(a.id),ready:!claimed.has(a.id)&&(metrics[a.metric]||0)>=a.goal}));
  }
  claimAchievements(guild,user) {
    return this.db.transaction(()=>{
      const ready=this.achievementStatus(guild,user).filter(a=>a.ready),reward=ready.reduce((n,a)=>n+a.reward,0),row=this.user(guild,user);
      integer(row.balance+row.bank+reward);
      for(const a of ready){
        this.db.prepare('INSERT INTO achievement_claims VALUES (?,?,?,?)').run(guild,user,a.id,Date.now());
        this.db.prepare('UPDATE users SET balance=balance+? WHERE guild_id=? AND user_id=?').run(a.reward,guild,user);
        this.#record(guild,user,'achievement',a.reward,a.name);
      }
      return {count:ready.length,reward,names:ready.map(a=>a.name),balance:this.user(guild,user).balance};
    })();
  }
  warning(guild, id) { return this.db.prepare('SELECT * FROM warnings WHERE guild_id=? AND id=?').get(guild, id); }
  channelLock(channel) { return this.db.prepare('SELECT * FROM channel_locks WHERE channel_id=?').get(channel); }
  saveChannelLock(guild, channel, previous) {
    this.db.prepare('INSERT OR IGNORE INTO channel_locks (guild_id,channel_id,previous_send,created_at) VALUES (?,?,?,?)').run(guild, channel, previous, Date.now());
  }
  deleteChannelLock(channel) { this.db.prepare('DELETE FROM channel_locks WHERE channel_id=?').run(channel); }
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
