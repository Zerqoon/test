import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { config, ROOT } from './config.js';

const WIDTH = 1600;
const ASSETS = path.join(ROOT, 'assets');
const bundledFont = path.join(ASSETS, 'Manrope.ttf');
const systemRegular = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const systemBold = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
let FONT_FAMILY = 'DejaVu Sans';
// Debian slim images often contain no fonts at all; Dockerfile installs DejaVu and this
// explicit registration prevents Canvas from silently returning text-free images.
if (existsSync(bundledFont)) {
  GlobalFonts.registerFromPath(bundledFont, 'Manrope');
  FONT_FAMILY = 'Manrope';
} else if (existsSync(systemRegular) && existsSync(systemBold)) {
  // These system fonts are installed by the Dockerfile. Register explicit regular/bold faces
  // so text does not disappear in minimal Railway containers with an empty fontconfig cache.
  GlobalFonts.registerFromPath(systemRegular, 'WIDMO Sans');
  GlobalFonts.registerFromPath(systemBold, 'WIDMO Sans');
  FONT_FAMILY = 'WIDMO Sans';
}
console.info(`[Canvas] Font kart: ${FONT_FAMILY}${existsSync(bundledFont) ? ' (asset)' : ''}`);

const backgroundPromise = loadImage(path.join(ASSETS, 'background.png'));
const logoPromise = loadImage(path.join(ASSETS, 'widmo-logo.png'));
const avatarCache = new Map();
const WHITE = '#F7F7F7';
const SILVER = '#D7D7D7';
const MUTED = '#A6A6A9';
const DARK = '#080808';

function rounded(ctx, x, y, w, h, r = 18) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
function font(ctx, weight, size) { ctx.font = `${Math.max(400, Math.min(900, Number(weight) || 700))} ${Math.max(8, Number(size) || 16)}px \"${FONT_FAMILY}\"`; }
function writeFit(ctx, value, x, y, maxWidth, size, color = WHITE, weight = 900, min = 20) {
  let text = String(value ?? 'Nieznany użytkownik').replace(/[\r\n\t]/g, ' ').slice(0, 120);
  while (size > min) {
    font(ctx, weight, size);
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  font(ctx, weight, size);
  while (text.length && ctx.measureText(`${text}…`).width > maxWidth) text = text.slice(0, -1);
  if (text.length && ctx.measureText(text).width > maxWidth) text = `${text}…`;
  ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(text || '…', x, y);
  return { text, size };
}
function write(ctx, text, x, y, size, color = WHITE, weight = 700, align = 'left') {
  ctx.save();
  font(ctx, weight, size);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 2;
  ctx.fillText(String(text ?? ''), x, y);
  ctx.restore();
}
function label(ctx, text, x, y, size = 16, color = MUTED, align = 'left') {
  write(ctx, String(text).toUpperCase(), x, y, size, color, 800, align);
}
function formatNumber(value) {
  return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('pl-PL');
}
function shortDate(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleDateString('pl-PL', { day: '2-digit', month: 'short', year: 'numeric' });
}
function rankTitle(level) {
  if (level >= 50) return 'ELITA';
  if (level >= 40) return 'EKSPERT';
  if (level >= 30) return 'WETERAN AKTYWNOŚCI';
  if (level >= 20) return 'ZAANGAŻOWANY';
  if (level >= 10) return 'AKTYWNY';
  if (level >= 5) return 'REGULARNY';
  return 'STARTUJĄCY';
}

function drawGhostWatermark(ctx, x, y, scale = 1, alpha = .10) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.filter = 'blur(8px)';
  ctx.shadowColor = 'rgba(255,255,255,.55)';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#FFFFFF';
  // Soft white ghost silhouette inspired by the exact mascot uploaded by the owner.
  // It is a background watermark only; the real crown-and-ghost logo remains crisp in the foreground.
  ctx.beginPath();
  ctx.moveTo(0, -112);
  ctx.bezierCurveTo(40, -112, 56, -83, 56, -49);
  ctx.bezierCurveTo(56, -31, 60, -22, 77, -30);
  ctx.bezierCurveTo(98, -42, 117, -26, 135, -13);
  ctx.bezierCurveTo(151, -1, 139, 17, 121, 14);
  ctx.bezierCurveTo(108, 11, 103, 18, 105, 33);
  ctx.bezierCurveTo(108, 51, 124, 68, 111, 88);
  ctx.bezierCurveTo(98, 109, 72, 102, 62, 89);
  ctx.bezierCurveTo(60, 115, 38, 132, 15, 122);
  ctx.bezierCurveTo(1, 116, -3, 103, -5, 91);
  ctx.bezierCurveTo(-24, 112, -53, 110, -66, 88);
  ctx.bezierCurveTo(-79, 67, -62, 50, -64, 34);
  ctx.bezierCurveTo(-66, 18, -80, 11, -93, 15);
  ctx.bezierCurveTo(-112, 18, -121, 0, -104, -13);
  ctx.bezierCurveTo(-85, -28, -68, -41, -48, -29);
  ctx.bezierCurveTo(-37, -22, -56, -39, -56, -49);
  ctx.bezierCurveTo(-56, -83, -40, -112, 0, -112);
  ctx.closePath();
  ctx.fill();
  // Hollow facial details mirror the supplied ghost mark but stay faint in the background.
  ctx.filter = 'none';
  ctx.globalAlpha = alpha * .7;
  ctx.fillStyle = '#090909';
  ctx.beginPath(); ctx.ellipse(-18, -67, 6, 11, -.12, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(18, -67, 6, 11, .12, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, -40, 5, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

async function drawBase(height) {
  const c = createCanvas(WIDTH, height);
  const ctx = c.getContext('2d');
  const image = await backgroundPromise;
  // Crop to cover rather than stretch, so the watermark stays circular on every card ratio.
  const scale = Math.max(WIDTH / image.width, height / image.height);
  const drawW = image.width * scale;
  const drawH = image.height * scale;
  ctx.drawImage(image, (WIDTH - drawW) / 2, (height - drawH) / 2, drawW, drawH);

  const shade = ctx.createLinearGradient(0, 0, WIDTH, 0);
  shade.addColorStop(0, 'rgba(0,0,0,.68)');
  shade.addColorStop(.48, 'rgba(0,0,0,.44)');
  shade.addColorStop(1, 'rgba(0,0,0,.26)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, WIDTH, height);

  const vignette = ctx.createRadialGradient(WIDTH * .52, height * .44, height * .05, WIDTH * .52, height * .44, WIDTH * .72);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,.68)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WIDTH, height);

  // A soft, oversized white ghost remains visible behind the UI without competing with text.
  drawGhostWatermark(ctx, WIDTH * .78, height * .53, Math.min(2.0, height / 360), .095);

  // Double brushed-metal frame and restrained corner marks.
  ctx.strokeStyle = 'rgba(255,255,255,.54)';
  ctx.lineWidth = 2;
  rounded(ctx, 22, 22, WIDTH - 44, height - 44, 28);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.14)';
  ctx.lineWidth = 1;
  rounded(ctx, 33, 33, WIDTH - 66, height - 66, 22);
  ctx.stroke();
  ctx.lineWidth = 3;
  for (const [x, y, sx, sy] of [[44, 65, 1, 1], [WIDTH - 44, 65, -1, 1], [44, height - 65, 1, -1], [WIDTH - 44, height - 65, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(x, y + sy * 22); ctx.lineTo(x, y); ctx.lineTo(x + sx * 22, y); ctx.strokeStyle = 'rgba(255,255,255,.72)'; ctx.stroke();
  }
  return { canvas: c, ctx };
}

async function drawLogo(ctx, x, y, size, alpha = 1) {
  const img = await logoPromise;
  ctx.save();
  ctx.globalAlpha = alpha;
  // Keep the supplied crown-and-ghost mark crisp; use the glow only behind the edge.
  ctx.filter = 'none';
  ctx.shadowColor = 'rgba(255,255,255,.20)';
  ctx.shadowBlur = Math.max(3, size * .055);
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
}

async function loadAvatar(member) {
  const url = member?.displayAvatarURL?.({ extension: 'png', size: 256 })
    ?? member?.user?.displayAvatarURL?.({ extension: 'png', size: 256 });
  if (!url) return null;
  if (avatarCache.has(url)) return avatarCache.get(url);
  const promise = (async () => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || !['cdn.discordapp.com', 'media.discordapp.net'].includes(parsed.hostname)) return null;
      const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' });
      if (!response.ok) return null;
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > 4 * 1024 * 1024) return null;
      return await loadImage(buffer);
    } catch { return null; }
  })();
  avatarCache.set(url, promise);
  if (avatarCache.size > 180) avatarCache.delete(avatarCache.keys().next().value);
  return promise;
}

async function drawAvatar(ctx, member, x, y, radius, fallback = 'W') {
  const img = await loadAvatar(member);
  ctx.save();
  ctx.shadowColor = 'rgba(255,255,255,.42)';
  ctx.shadowBlur = 18;
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, radius + 7, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.clip();
  if (img) {
    ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
  } else {
    const grad = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
    grad.addColorStop(0, '#525255'); grad.addColorStop(1, '#111113');
    ctx.fillStyle = grad; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    font(ctx, 900, radius * .9); ctx.fillStyle = WHITE; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(fallback || 'W').slice(0, 1).toUpperCase(), x, y + 1);
  }
  ctx.restore();
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, radius + 2, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}

function drawBrand(ctx, subtitle = 'SYSTEM SPOŁECZNOŚCI') {
  label(ctx, config.serverName, 58, 71, 17, '#DADADA');
  write(ctx, 'W I D M O', 58, 108, 30, WHITE, 900);
  ctx.strokeStyle = 'rgba(255,255,255,.26)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(58, 126); ctx.lineTo(314, 126); ctx.stroke();
  label(ctx, subtitle, 58, 151, 13, MUTED);
}

function drawPill(ctx, x, y, w, text, icon = '✦') {
  ctx.fillStyle = 'rgba(245,245,245,.075)'; rounded(ctx, x, y, w, 42, 21); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.26)'; ctx.lineWidth = 1.2; ctx.stroke();
  write(ctx, `${icon}  ${text}`, x + 18, y + 27, 15, WHITE, 800);
}

function drawProgress(ctx, x, y, w, h, progress) {
  ctx.fillStyle = 'rgba(255,255,255,.105)'; rounded(ctx, x, y, w, h, h / 2); ctx.fill();
  const p = Math.min(1, Math.max(0, Number(progress) || 0));
  if (p <= 0) return;
  const fillWidth = Math.max(h, w * p);
  const grad = ctx.createLinearGradient(x, y, x + w, y);
  grad.addColorStop(0, '#77777B'); grad.addColorStop(.52, '#D8D8DC'); grad.addColorStop(1, '#FFFFFF');
  ctx.fillStyle = grad; rounded(ctx, x, y, Math.min(w, fillWidth), h, h / 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.42)'; ctx.lineWidth = 1; rounded(ctx, x, y, w, h, h / 2); ctx.stroke();
}

function drawStat(ctx, x, y, w, title, value, subtitle = '') {
  ctx.fillStyle = 'rgba(0,0,0,.44)'; rounded(ctx, x, y, w, 92, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.17)'; ctx.lineWidth = 1; ctx.stroke();
  label(ctx, title, x + 18, y + 28, 12, MUTED);
  write(ctx, value, x + 18, y + 60, 25, WHITE, 900);
  if (subtitle) label(ctx, subtitle, x + w - 16, y + 58, 10, SILVER, 'right');
}

export async function welcomeCard(member) {
  const { canvas, ctx } = await drawBase(780);
  drawBrand(ctx, 'WITAMY NA SERWERZE');
  await drawLogo(ctx, WIDTH - 160, 48, 86, .95);
  drawPill(ctx, WIDTH - 450, 65, 242, 'NOWY CZŁONEK', '✓');

  await drawAvatar(ctx, member, 178, 339, 91, member.displayName ?? member.user?.username ?? 'W');
  label(ctx, 'DOŁĄCZYŁ NOWY CZŁONEK', 330, 255, 18, SILVER);
  write(ctx, 'WITAJ NA SERWERZE!', 328, 321, 44, WHITE, 900);
  writeFit(ctx, member.displayName ?? member.user?.globalName ?? member.user?.username ?? 'Nieznany użytkownik', 325, 408, 1000, 78, WHITE, 900, 42);
  write(ctx, 'Miło Cię widzieć — dobrze, że jesteś z nami.', 332, 463, 25, '#C9C9CC', 600);
  label(ctx, 'Zapoznaj się z regulaminem i poznaj społeczność.', 332, 505, 15, MUTED);

  ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(76, 560); ctx.lineTo(WIDTH - 76, 560); ctx.stroke();
  drawStat(ctx, 78, 589, 410, 'DOŁĄCZENIE DO SERWERA', shortDate(member.joinedAt ?? member.joinedTimestamp), 'DOŁĄCZENIE');
  drawStat(ctx, 507, 589, 410, 'WIEK KONTA DISCORD', shortDate(member.user?.createdAt ?? member.user?.createdTimestamp), 'UTWORZENIE');
  drawStat(ctx, 936, 589, 585, 'LICZBA CZŁONKÓW', formatNumber(member.guild?.memberCount), 'WIDMO');
  label(ctx, `WIDMO  /  ${member.user?.username ? `@${member.user.username}` : 'NOWY CZŁONEK'}`, 80, 728, 13, '#B9B9BC');
  label(ctx, 'DOBRZE, ŻE JESTEŚ Z NAMI', WIDTH - 80, 728, 13, '#B9B9BC', 'right');
  return canvas.encode('png');
}

export async function rankCard(member, { xp = 0, level = 0, currentXp = 0, neededXp = 1, rank = '—', messages = 0 }) {
  const { canvas, ctx } = await drawBase(800);
  drawBrand(ctx, 'PROFIL AKTYWNOŚCI • STATYSTYKI');
  drawPill(ctx, WIDTH - 365, 60, 270, `MIEJSCE W TOP  #${rank || '—'}`, '♛');

  await drawAvatar(ctx, member, 190, 322, 94, member.displayName ?? member.user?.username ?? 'W');
  label(ctx, 'PROFIL UŻYTKOWNIKA', 335, 225, 17, SILVER);
  writeFit(ctx, member.displayName ?? member.user?.globalName ?? member.user?.username ?? 'Nieznany użytkownik', 332, 292, 780, 59, WHITE, 900, 30);
  label(ctx, rankTitle(level), 337, 331, 18, '#D1D1D4');
  write(ctx, `${formatNumber(xp)} XP`, 335, 399, 37, WHITE, 900);
  label(ctx, `${formatNumber(messages)} ZAKWALIFIKOWANYCH WIADOMOŚCI`, 337, 431, 13, MUTED);

  ctx.fillStyle = 'rgba(0,0,0,.44)'; rounded(ctx, 1190, 186, 270, 286, 28); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.5; ctx.stroke();
  label(ctx, 'POZIOM', 1325, 233, 17, SILVER, 'center');
  write(ctx, String(level), 1325, 360, 112, WHITE, 900, 'center');
  ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.moveTo(1230, 389); ctx.lineTo(1420, 389); ctx.stroke();
  label(ctx, `RANGA ${level >= 50 ? 'MAX' : `${level + 1}`}`, 1325, 428, 14, MUTED, 'center');
  await drawLogo(ctx, 1440, 116, 56, .72);

  label(ctx, `POSTĘP DO POZIOMU ${level + 1}`, 83, 522, 17, SILVER);
  label(ctx, `${formatNumber(currentXp)} / ${formatNumber(neededXp)} XP`, WIDTH - 83, 522, 19, WHITE, 'right');
  drawProgress(ctx, 83, 546, WIDTH - 166, 27, currentXp / Math.max(1, neededXp));
  write(ctx, `Brakuje ${formatNumber(Math.max(0, neededXp - currentXp))} XP do kolejnego awansu`, 83, 609, 22, WHITE, 800);

  drawStat(ctx, 83, 639, 430, 'XP ŁĄCZNIE', formatNumber(xp), 'POSTĘP');
  drawStat(ctx, 536, 639, 430, 'AKTYWNOŚĆ CZATU', formatNumber(messages), 'WIADOMOŚCI');
  drawStat(ctx, 989, 639, 528, 'TWOJE MIEJSCE', `#${rank || '—'}`, 'RANKING');
  label(ctx, 'BĄDŹ AKTYWNY  •  ZDOBYWAJ XP  •  AWANSUJ', 84, 763, 13, '#C4C4C7');
  label(ctx, 'WIDMO / POZIOMY', WIDTH - 84, 763, 13, '#C4C4C7', 'right');
  return canvas.encode('png');
}

export async function levelUpCard(member, stats) {
  const { canvas, ctx } = await drawBase(760);
  drawBrand(ctx, 'POWIADOMIENIE O AWANSIE');
  await drawLogo(ctx, WIDTH - 340, 160, 220, .78);
  await drawAvatar(ctx, member, 230, 360, 92, member.displayName ?? member.user?.username ?? 'W');

  label(ctx, 'GRATULACJE! NOWY POZIOM', 390, 254, 19, SILVER);
  write(ctx, 'AWANS!', 383, 337, 86, WHITE, 900);
  writeFit(ctx, member.displayName ?? member.user?.username ?? 'Nieznany użytkownik', 390, 392, 700, 39, WHITE, 900, 24);
  label(ctx, 'OSIĄGASZ POZIOM', 395, 447, 16, MUTED);
  write(ctx, String(stats.level), 390, 566, 112, WHITE, 900);
  label(ctx, rankTitle(stats.level), 535, 550, 20, SILVER);
  write(ctx, `${formatNumber(stats.xp)} XP ŁĄCZNIE`, 535, 592, 23, WHITE, 800);

  ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.moveTo(82, 634); ctx.lineTo(WIDTH - 82, 634); ctx.stroke();
  label(ctx, 'ŚWIETNA ROBOTA — KOLEJNY POZIOM JUŻ CZEKA', 84, 683, 16, WHITE);
  label(ctx, `MIEJSCE W RANKINGU  #${stats.rank ?? '—'}`, WIDTH - 84, 683, 14, SILVER, 'right');
  return canvas.encode('png');
}

export async function leaderboardCard(guild, entries = []) {
  const { canvas, ctx } = await drawBase(960);
  drawBrand(ctx, 'RANKING AKTYWNOŚCI SERWERA');
  await drawLogo(ctx, WIDTH - 165, 45, 92, .9);
  label(ctx, 'TOP 10', 83, 211, 23, SILVER);
  write(ctx, 'TOP 10 AKTYWNYCH', 83, 263, 46, WHITE, 900);
  label(ctx, 'Ranking według całkowitej liczby zdobytych punktów XP.', 85, 294, 15, MUTED);

  const visible = entries.slice(0, 10);
  if (!visible.length) {
    ctx.fillStyle = 'rgba(0,0,0,.42)'; rounded(ctx, 80, 350, WIDTH - 160, 180, 24); ctx.fill();
    write(ctx, 'Brak wyników w rankingu.', WIDTH / 2, 440, 28, WHITE, 800, 'center');
    label(ctx, 'ZDOBYWAJ XP, ABY POJAWIĆ SIĘ W TOP 10', WIDTH / 2, 485, 14, MUTED, 'center');
  } else {
    for (let index = 0; index < visible.length; index++) {
      const row = visible[index];
      const y = 330 + index * 54;
      ctx.fillStyle = index < 3 ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.35)';
      rounded(ctx, 82, y, WIDTH - 164, 45, 13); ctx.fill();
      ctx.strokeStyle = index < 3 ? 'rgba(255,255,255,.32)' : 'rgba(255,255,255,.10)'; ctx.lineWidth = 1; ctx.stroke();
      const medal = ['Ⅰ', 'Ⅱ', 'Ⅲ'][index] || String(index + 1).padStart(2, '0');
      write(ctx, medal, 112, y + 29, index < 3 ? 21 : 17, index === 0 ? '#FFFFFF' : index === 1 ? '#D6D6D6' : '#A9A9AD', 900);
      await drawAvatar(ctx, row.member ?? null, 172, y + 22, 17, row.name ?? row.userId ?? 'W');
      writeFit(ctx, row.name ?? row.member?.displayName ?? `Użytkownik ${String(row.userId ?? '').slice(-4)}`, 207, y + 29, 760, 19, WHITE, 800, 14);
      label(ctx, `LV ${row.level ?? 0}`, 1120, y + 28, 13, SILVER, 'right');
      write(ctx, `${formatNumber(row.xp)} XP`, WIDTH - 112, y + 29, 18, WHITE, 900, 'right');
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.moveTo(82, 909); ctx.lineTo(WIDTH - 82, 909); ctx.stroke();
  label(ctx, 'WIDMO  /  RANKING AKTYWNOŚCI', 84, 937, 12, '#C4C4C7');
  label(ctx, `AKTUALIZACJA  ${new Date().toLocaleDateString('pl-PL')}`, WIDTH - 84, 937, 12, '#C4C4C7', 'right');
  return canvas.encode('png');
}

export async function levelPanelCard() {
  const { canvas, ctx } = await drawBase(520);
  await drawLogo(ctx, 100, 139, 220, .98);
  label(ctx, 'WIDMO • SYSTEM AKTYWNOŚCI', 365, 160, 17, SILVER);
  write(ctx, 'SYSTEM POZIOMÓW', 360, 222, 55, WHITE, 900);
  write(ctx, 'Zdobywaj XP i sprawdzaj swój postęp.', 365, 270, 25, '#D0D0D3', 600);
  label(ctx, 'AKTYWNOŚĆ  /  POZIOMY  /  RANKING  /  NAGRODY', 366, 315, 14, MUTED);

  const cards = [
    { x: 366, title: '01 / WIADOMOŚCI', value: `${config.xp.messageMin}–${config.xp.messageMax} XP`, desc: 'za kwalifikującą się wiadomość' },
    { x: 720, title: '02 / VOICE', value: `${config.xp.voicePerTick} XP`, desc: `co ${Math.round(config.xp.voiceIntervalSeconds / 60)} min` },
    { x: 1074, title: '03 / RANGI', value: 'AUTOMATYCZNIE', desc: 'nagrody za poziomy' },
  ];
  for (const item of cards) {
    ctx.fillStyle = 'rgba(0,0,0,.47)'; rounded(ctx, item.x, 358, 310, 92, 18); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1.2; ctx.stroke();
    label(ctx, item.title, item.x + 18, 382, 11, MUTED);
    write(ctx, item.value, item.x + 18, 414, item.value.length > 11 ? 17 : 24, WHITE, 900);
    label(ctx, item.desc, item.x + 18, 436, 10, SILVER);
  }
  label(ctx, 'UŻYJ PRZYCISKÓW PONIŻEJ, ABY OTWORZYĆ SWOJĄ KARTĘ I STATYSTYKI', 83, 484, 13, '#C4C4C7');
  return canvas.encode('png');
}
