import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import path from 'node:path';
import { config, ROOT } from './config.js';

GlobalFonts.registerFromPath(path.join(ROOT, 'assets/Manrope.ttf'), 'Manrope');
const background = loadImage(path.join(ROOT, 'assets/background.png'));
const WHITE = '#F6F2FF';
const LAVENDER = '#C5B6FF';
function rounded(ctx, x, y, w, h, r = 18) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}
function font(ctx, weight, size) { ctx.font = `${weight} ${size}px Manrope`; }
function fit(ctx, text, maxWidth, size, weight = 800, min = 24) {
  text = String(text ?? '').replace(/[\r\n\t]/g, ' ').slice(0, 100);
  while (size > min) { font(ctx, weight, size); if (ctx.measureText(text).width <= maxWidth) return text; size -= 1; }
  font(ctx, weight, size);
  while (text.length && ctx.measureText(text + '…').width > maxWidth) text = text.slice(0, -1);
  return text + '…';
}
function label(ctx, text, x, y, size = 18, color = LAVENDER) {
  font(ctx, 700, size); ctx.fillStyle = color; ctx.fillText(text, x, y);
}
function moon(ctx, x, y) {
  ctx.fillStyle = '#D0C5FF'; ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#19132F'; ctx.beginPath(); ctx.arc(x + 7, y - 5, 13, 0, Math.PI * 2); ctx.fill();
}
async function base(height) {
  const c = createCanvas(1400, height); const ctx = c.getContext('2d'); const img = await background;
  const blur = config.cards?.backgroundBlur ?? 16;
  // Blur only the background. Overscan prevents transparent edges from the blur kernel.
  // Restore before drawing gradients, borders, avatars and text to keep the interface sharp.
  const margin = Math.ceil(blur * 3);
  const scale = Math.max((c.width + margin * 2) / img.width, (height + margin * 2) / img.height);
  ctx.save();
  ctx.filter = blur > 0 ? `blur(${blur}px)` : 'none';
  ctx.drawImage(img, (c.width - img.width * scale) / 2, (height - img.height * scale) / 2, img.width * scale, img.height * scale);
  ctx.restore();
  const shade = ctx.createLinearGradient(0, 0, 1400, 0);
  shade.addColorStop(0, 'rgba(8,7,24,0.94)'); shade.addColorStop(.48, 'rgba(13,9,32,0.65)'); shade.addColorStop(1, 'rgba(10,8,28,0.08)');
  ctx.fillStyle = shade; ctx.fillRect(0, 0, 1400, height);
  const floor = ctx.createLinearGradient(0, height / 2, 0, height);
  floor.addColorStop(0, 'rgba(9,7,25,0)'); floor.addColorStop(1, 'rgba(9,7,25,0.97)');
  ctx.fillStyle = floor; ctx.fillRect(0, 0, 1400, height);
  ctx.strokeStyle = 'rgba(204,188,255,.35)'; ctx.lineWidth = 1.5; rounded(ctx, 18, 18, 1364, height - 36, 24); ctx.stroke();
  moon(ctx, 71, 66); label(ctx, config.serverName.toUpperCase(), 101, 73, 22, WHITE);
  return { c, ctx };
}
async function drawAvatar(ctx, member, x, y, r) {
  let img;
  try {
    const url = member.displayAvatarURL?.({ extension: 'png', size: 256 }) ?? member.user?.displayAvatarURL?.({ extension: 'png', size: 256 });
    if (url) {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || !['cdn.discordapp.com', 'media.discordapp.net'].includes(parsed.hostname)) throw new Error('Nieprawidłowa domena avatara.');
      const response = await fetch(url, { signal: AbortSignal.timeout(6000), redirect: 'error' });
      if (!response.ok) throw new Error(`Avatar HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > 4 * 1024 * 1024) throw new Error('Avatar zbyt duży');
      img = await loadImage(buffer);
    }
  } catch { /* Local monogram keeps cards available during CDN failures. */ }
  ctx.save(); ctx.shadowColor = '#9B79FF'; ctx.shadowBlur = 32;
  ctx.strokeStyle = '#C5B6FF'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, r + 7, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  if (img) ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
  else {
    const g = ctx.createLinearGradient(x-r,y-r,x+r,y+r);g.addColorStop(0,'#865BF5');g.addColorStop(1,'#242048');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
    font(ctx, 800, r); ctx.fillStyle = WHITE; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((member.displayName ?? member.user?.username ?? 'M').slice(0, 1).toUpperCase(), x, y);
  }
  ctx.restore();
}
function pill(ctx, text, x, y, width) {
  ctx.fillStyle = 'rgba(30,22,63,.78)'; rounded(ctx, x, y, width, 42, 21); ctx.fill();
  ctx.strokeStyle = 'rgba(197,182,255,.5)';ctx.lineWidth=1;ctx.stroke();label(ctx, text, x + 19, y + 28, 16, WHITE);
}
export async function welcomeCard(member) {
  const { c, ctx } = await base(700);
  pill(ctx, 'NOWA OSOBA W EKIPIE', 1080, 46, 265);
  await drawAvatar(ctx, member, 139, 242, 70);
  label(ctx, 'WITAJ W NASZYM ŚWIECIE', 58, 363, 19);
  ctx.fillStyle = WHITE; const name = fit(ctx, member.displayName ?? member.user?.username, 950, 69); ctx.fillText(name, 54, 451);
  label(ctx, 'Rozgość się. Poznaj ekipę. Zostań na dłużej.', 59, 503, 25, '#DBD4ED');
  ctx.strokeStyle = 'rgba(202,189,242,.25)';ctx.beginPath();ctx.moveTo(59,556);ctx.lineTo(820,556);ctx.stroke();
  label(ctx, 'ZACZNIJ OD REGULAMINU', 59, 608, 15, '#A398BC');
  label(ctx, 'Twoja przygoda zaczyna się tutaj.', 59, 641, 22, WHITE);
  ctx.textAlign='right';label(ctx, `${member.guild?.memberCount ?? '—'}`, 1336, 610, 43, WHITE);label(ctx, 'OSÓB NA SERWERZE', 1336, 644, 13);ctx.textAlign='left';
  return c.encode('png');
}
export async function rankCard(member, { xp, level, currentXp, neededXp, rank }) {
  const { c, ctx } = await base(620);
  pill(ctx, `RANKING  #${rank || '—'}`, 1150, 46, 195);
  await drawAvatar(ctx, member, 149, 261, 82);
  label(ctx, 'KARTA PROFILU', 280, 207, 16);
  const name = fit(ctx, member.displayName ?? member.user?.username, 715, 52);
  ctx.fillStyle=WHITE;ctx.fillText(name,280,270);
  label(ctx, `${Number(xp).toLocaleString('pl-PL')} XP ŁĄCZNIE`, 283, 317, 18, '#D2C8E8');
  ctx.textAlign='right';label(ctx,'POZIOM',1336,215,18);font(ctx,800,102);ctx.fillStyle=WHITE;ctx.fillText(String(level),1341,319);ctx.textAlign='left';
  const progress=Math.min(1,Math.max(0,currentXp/Math.max(1,neededXp)));
  label(ctx, `DROGA DO POZIOMU ${level+1}`, 65, 411, 17);
  ctx.textAlign='right';label(ctx, `${currentXp.toLocaleString('pl-PL')} / ${neededXp.toLocaleString('pl-PL')} XP`, 1335,411,20,WHITE);ctx.textAlign='left';
  ctx.fillStyle='rgba(219,207,255,.16)';rounded(ctx,65,437,1270,24,12);ctx.fill();
  if(progress>0){ const bar=ctx.createLinearGradient(65,0,1335,0);bar.addColorStop(0,'#8564FA');bar.addColorStop(.7,'#C2A8FF');bar.addColorStop(1,'#83E6FF');ctx.fillStyle=bar;rounded(ctx,65,437,Math.max(24,1270*progress),24,12);ctx.fill(); }
  ctx.strokeStyle='rgba(202,189,242,.25)';ctx.beginPath();ctx.moveTo(65,503);ctx.lineTo(1335,503);ctx.stroke();
  label(ctx, 'PISZ  ·  ROZMAWIAJ  ·  ZDOBYWAJ ROLE',65,554,16,'#AEA1C6');
  ctx.textAlign='right';label(ctx,member.roles?.cache?.has(config.roles.booster)?'BOOSTER  /  XP ×1,5':'KAŻDY POZIOM MA ZNACZENIE',1335,554,16,LAVENDER);
  return c.encode('png');
}
