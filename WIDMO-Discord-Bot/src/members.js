import { Events, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import path from 'node:path';
import { config, ROOT } from './config.js';
import { welcomeCard } from './cards.js';
import { embed } from './shared.js';
import { db } from './db.js';

db.exec(`CREATE TABLE IF NOT EXISTS autorole_jobs (
  guild_id TEXT NOT NULL, user_id TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(guild_id,user_id)
); CREATE TABLE IF NOT EXISTS member_welcomes (
  guild_id TEXT NOT NULL, user_id TEXT NOT NULL, joined_at INTEGER NOT NULL,
  PRIMARY KEY(guild_id,user_id)
);`);

export function installMembers(client) {
  let busy = false;
  let backfillBusy = false;
  let backfillDone = false;
  let backfillRetryAt = 0;
  let stopped = false;
  const removeJob = job => db.prepare('DELETE FROM autorole_jobs WHERE guild_id=? AND user_id=?').run(job.guild_id, job.user_id);
  const retry = (job, delay, failed = false) => db.prepare('UPDATE autorole_jobs SET next_attempt=?,attempts=attempts+? WHERE guild_id=? AND user_id=?').run(Date.now() + delay, failed ? 1 : 0, job.guild_id, job.user_id);
  const processJobs = async () => {
    if (busy || stopped || !client.isReady()) return;
    busy = true;
    try {
      const jobs = db.prepare('SELECT * FROM autorole_jobs WHERE guild_id=? AND next_attempt<=? LIMIT 30').all(config.guildId, Date.now());
      for (const job of jobs) {
        if (stopped) break;
        const guild = client.guilds.cache.get(job.guild_id);
        if (!guild?.available) continue;
        try {
          const member = await guild.members.fetch(job.user_id);
          if (member.user.bot) { removeJob(job); continue; }
          if (member.pending) { retry(job, 30_000); continue; }
          let failed = false;
          for (const roleId of config.roles.auto) {
            if (member.roles.cache.has(roleId)) continue;
            try {
              const role = await guild.roles.fetch(roleId);
              if (!role?.editable) throw new Error(`Rola ${roleId} nie istnieje albo jest nad botem.`);
              await member.roles.add(role, 'Automatyczna rola po dołączeniu');
            } catch (error) {
              if (error.code === 10007) throw error;
              failed = true;
              if (!job.attempts || job.attempts % 5 === 0) console.error(`[autorole] Ponowimy rolę ${roleId}:`, error.message);
            }
          }
          if (failed) retry(job, Math.min(3_600_000, 30_000 * 2 ** Math.min(job.attempts, 7)), true);
          else removeJob(job);
        } catch (error) {
          if (error.code === 10007) { removeJob(job); continue; }
          retry(job, Math.min(3_600_000, 30_000 * 2 ** Math.min(job.attempts, 7)), true);
          if (!job.attempts || job.attempts % 5 === 0) console.error('[autorole] Ponowimy sprawdzenie użytkownika:', error);
        }
      }
    } catch (error) { console.error('[autorole] Kolejka:', error); }
    finally { busy = false; }
  };
  const backfillMissingRoles = async () => {
    if (stopped || backfillBusy || backfillDone || Date.now() < backfillRetryAt || !client.isReady() || !config.roles.auto?.length) return;
    const guild = client.guilds.cache.get(config.guildId);
    if (!guild?.available) return;
    backfillBusy = true;
    try {
      // Fetch the full member collection once on startup so existing members also receive
      // every configured autorole. The durable queue then retries permission/screening failures.
      const fetched = await guild.members.fetch();
      const values = fetched && typeof fetched.values === 'function' ? fetched.values() : [];
      const enqueue = db.prepare('INSERT OR IGNORE INTO autorole_jobs(guild_id,user_id,attempts,next_attempt) VALUES(?,?,0,0)');
      for (const member of values) {
        if (stopped || member.user?.bot) continue;
        if (config.roles.auto.some(roleId => !member.roles?.cache?.has(roleId))) {
          enqueue.run(guild.id, member.id);
        }
      }
      backfillDone = true;
      console.log(`[autorole] Sprawdzono członków serwera ${guild.id}; role zostaną uzupełnione z kolejki.`);
    } catch (error) {
      backfillRetryAt = Date.now() + 60_000;
      console.error('[autorole] Nie udało się przeskanować obecnych członków. Ponowię próbę za minutę:', error.message);
    } finally {
      backfillBusy = false;
    }
  };
  const joined = async member => {
    if (member.guild.id !== config.guildId || member.user.bot) return;
    db.prepare('INSERT INTO autorole_jobs(guild_id,user_id) VALUES(?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET attempts=0,next_attempt=0').run(member.guild.id, member.id);
    void processJobs();
    if (!config.channels.welcome) return;
    // Retry jobs never send welcomes. The join timestamp also deduplicates replayed join events.
    const claimed = db.prepare(`INSERT INTO member_welcomes(guild_id,user_id,joined_at) VALUES(?,?,?)
      ON CONFLICT(guild_id,user_id) DO UPDATE SET joined_at=excluded.joined_at WHERE joined_at<>excluded.joined_at`)
      .run(member.guild.id, member.id, member.joinedTimestamp || 0);
    if (!claimed.changes) return;
    const channel = await client.channels.fetch(config.channels.welcome);
    if (!channel?.isTextBased() || !channel.send || channel.guildId !== config.guildId) throw new Error('Nieprawidłowy kanał powitań.');
    const files = [new AttachmentBuilder(path.join(ROOT, 'assets/widmo-logo.png'), { name: 'widmo-logo.png' })];
    try { files.push(new AttachmentBuilder(await welcomeCard(member), { name: 'welcome.png' })); } catch (e) { console.error('[welcome canvas]', e); }
    const card = embed('👋 Witamy na serwerze!', `<@${member.id}>, cieszymy się, że dołączasz do **${config.serverName}**.\nZapoznaj się z regulaminem, poznaj społeczność i śmiało dołącz do rozmowy.\n\n**Miło, że jesteś z nami!**`);
    card.setThumbnail('attachment://widmo-logo.png');
    if (files.some(file => file.name === 'welcome.png')) card.setImage('attachment://welcome.png');
    const components = config.channels.rules ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Otwórz regulamin').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${config.guildId}/${config.channels.rules}`))] : [];
    await channel.send({ content: `Witaj <@${member.id}>!`, embeds: [card], files, ...(components.length ? { components } : {}), allowedMentions: { users: [member.id], roles: [] } });
  };
  const updated = (before, after) => {
    if (after.guild.id !== config.guildId || !before.pending || after.pending) return;
    // Resume a pending join job after Discord Membership Screening; the startup backfill handles existing members separately.
    db.prepare('UPDATE autorole_jobs SET next_attempt=0 WHERE guild_id=? AND user_id=?').run(after.guild.id, after.id);
    return processJobs();
  };
  const onJoin = m => joined(m).catch(e => console.error('[welcome]', e));
  const onUpdate = (a,b) => Promise.resolve(updated(a,b)).catch(e => console.error('[autorole screening]', e));
  const onReady = () => {
    void backfillMissingRoles().finally(() => processJobs()).catch(e => console.error('[autorole backfill]', e));
    void processJobs();
  };
  client.on(Events.GuildMemberAdd, onJoin); client.on(Events.GuildMemberUpdate, onUpdate);
  client.on(Events.ClientReady, onReady);
  const timer = setInterval(() => {
    if (!backfillDone) void backfillMissingRoles().finally(() => processJobs()).catch(e => console.error('[autorole backfill]', e));
    else void processJobs();
  }, 10_000); timer.unref?.();
  if (client.isReady()) onReady();
  return { stop() { stopped = true; clearInterval(timer); client.off(Events.GuildMemberAdd, onJoin); client.off(Events.GuildMemberUpdate, onUpdate); client.off(Events.ClientReady, onReady); } };
}
