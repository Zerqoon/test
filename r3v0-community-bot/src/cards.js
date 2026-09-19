import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { progressForXp, levelForXp } from './level.js';

const fonts = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/fonts');
GlobalFonts.registerFromPath(path.join(fonts, 'DejaVuSans.ttf'), 'Guild');
GlobalFonts.registerFromPath(path.join(fonts, 'DejaVuSans-Bold.ttf'), 'Guild Bold');
const C = { bg: '#0B0B14', panel: '#171726', purple: '#A76CFF', pink: '#F17AD9', lime: '#C5FF60', muted: '#9396AD', white: '#F7F5FF', border: '#323247' };
const fmt = n => new Intl.NumberFormat('pl-PL').format(n);

function round(ctx, x, y, w, h, r, color, stroke = null) {
  ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fillStyle=color; ctx.fill();
  if (stroke) { ctx.lineWidth=1.5; ctx.strokeStyle=stroke; ctx.stroke(); }
}
function text(ctx, value, x, y, size, color=C.white, bold=false, maxWidth=null) {
  ctx.font = `${size}px '${bold ? 'Guild Bold' : 'Guild'}'`;
  ctx.fillStyle=color; ctx.textBaseline='alphabetic';
  const str=String(value);
  if (!maxWidth || ctx.measureText(str).width <= maxWidth) { ctx.fillText(str,x,y); return; }
  let clipped=str;
  while (clipped.length && ctx.measureText(`${clipped}…`).width>maxWidth) clipped=clipped.slice(0,-1);
  ctx.fillText(`${clipped}…`,x,y);
}
function base(w=1080,h=500,label='COMMUNITY / PROFILE') {
  const cv=createCanvas(w,h), ctx=cv.getContext('2d');
  const bg=ctx.createLinearGradient(0,0,w,h); bg.addColorStop(0,'#090914'); bg.addColorStop(.58,'#161225'); bg.addColorStop(1,'#0B1020');
  ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);
  for (const [x,y,r,color] of [[100,80,270,'rgba(169,91,255,.13)'],[w-90,90,280,'rgba(70,105,255,.15)'],[w*.65,h,230,'rgba(230,69,176,.09)']]) {
    const glow=ctx.createRadialGradient(x,y,0,x,y,r); glow.addColorStop(0,color);glow.addColorStop(1,'transparent');ctx.fillStyle=glow;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  ctx.strokeStyle='rgba(189,153,255,.045)';ctx.lineWidth=1;
  for(let x=-h;x<w+h;x+=34){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+h,h);ctx.stroke();}
  ctx.save(); ctx.translate(w-180,130);ctx.rotate(-.25);
  for(let i=0;i<4;i++){ctx.strokeStyle=`rgba(183,119,255,${.12-i*.02})`;ctx.lineWidth=2;ctx.strokeRect(-90+i*21,-90+i*21,180-i*42,180-i*42);}
  ctx.restore();
  ctx.fillStyle=C.purple;ctx.fillRect(0,0,w,6);
  round(ctx,32,27,Math.min(290,w-64),35,9,'rgba(174,121,255,.14)','rgba(175,115,255,.28)');
  text(ctx,label,48,51,13,C.purple,true);
  text(ctx,'◆  R3V0  /  COMMUNITY',w-310,h-23,13,C.muted,true);
  return {cv,ctx};
}
function metric(ctx,x,y,w,label,value,accent=C.purple){
  round(ctx,x,y,w,111,18,'rgba(30,30,47,.88)',C.border);
  ctx.fillStyle=accent;ctx.fillRect(x+20,y+22,4,19);
  text(ctx,label.toUpperCase(),x+36,y+38,12,C.muted,true,w-50);
  text(ctx,value,x+20,y+83,31,C.white,true,w-36);
}
async function avatar(ctx,user,x,y,r){
  ctx.save();ctx.shadowColor='rgba(182,96,255,.75)';ctx.shadowBlur=25;
  ctx.beginPath();ctx.arc(x,y,r+7,0,Math.PI*2);ctx.fillStyle=C.purple;ctx.fill();ctx.restore();
  ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.clip();
  const grad=ctx.createLinearGradient(x-r,y-r,x+r,y+r);grad.addColorStop(0,'#6D4DD6');grad.addColorStop(1,'#D95CC8');
  ctx.fillStyle=grad;ctx.fillRect(x-r,y-r,r*2,r*2);
  if(user?.avatarURL && /^https:\/\/cdn\.discord(?:app)?\.com\//.test(user.avatarURL)){
    try {
      const reply=await fetch(user.avatarURL,{signal:AbortSignal.timeout(4500)});
      if(reply.ok && Number(reply.headers.get('content-length') || 0)<5_000_000) {
        const bytes=Buffer.from(await reply.arrayBuffer());
        if(bytes.length<5_000_000) ctx.drawImage(await loadImage(bytes),x-r,y-r,r*2,r*2);
      }
    } catch { /* gradient avatar is the fallback */ }
  } else {
    text(ctx,(user?.name || '?').slice(0,1).toUpperCase(),x-r*.38,y+r*.4,r*.95,C.white,true);
  }
  ctx.restore();
}

export async function profileCard(user,row,rank,roleName='Wędrowiec'){
  const {cv,ctx}=base(1080,505,'DOSSIER GRACZA   /   PROFIL');
  await avatar(ctx,user,133,190,69);
  text(ctx,user.name,230,154,35,C.white,true,790);
  text(ctx,`@${user.username || user.name}`,232,186,16,C.muted,false,760);
  round(ctx,230,210,Math.min(315,Math.max(180,roleName.length*13)),38,10,'rgba(175,120,255,.19)','rgba(175,120,255,.31)');
  text(ctx,`◆  ${roleName.toUpperCase()}`,248,236,14,C.purple,true);
  if(row.title) text(ctx,row.title,33,303,17,C.lime,true,800);
  metric(ctx,32,330,324,'Poziom',String(progressForXp(row.xp).level).padStart(2,'0'),C.purple);
  metric(ctx,378,330,324,'Ranking serwera',`#${fmt(rank)}`,C.lime);
  metric(ctx,724,330,324,'Monety',fmt(row.balance),C.pink);
  const progress=progressForXp(row.xp);
  round(ctx,231,273,809,16,8,'rgba(118,107,148,.31)');
  if(progress.fraction>0){const grad=ctx.createLinearGradient(231,0,1040,0);grad.addColorStop(0,C.purple);grad.addColorStop(1,C.pink);round(ctx,231,273,Math.max(8,809*progress.fraction),16,8,grad);}
  text(ctx,`XP ${fmt(progress.current)} / ${fmt(progress.required)}`,232,263,13,C.muted,true);
  text(ctx,`WIADOMOŚCI  ${fmt(row.messages)}     •     VC  ${Math.floor(row.voice_seconds/3600)} H`,34,473,13,C.muted,true);
  return cv.toBuffer('image/png');
}

export async function rankCard(user,row,rank){
  const {cv,ctx}=base(1080,385,'RANKING / PROGRES');
  await avatar(ctx,user,126,172,68);
  text(ctx,user.name,228,145,34,C.white,true,775);
  const p=progressForXp(row.xp);
  text(ctx,`POZIOM ${String(p.level).padStart(2,'0')}`,228,197,30,C.lime,true);
  text(ctx,`#${fmt(rank)} NA SERWERZE`,797,198,20,C.purple,true);
  round(ctx,43,257,994,23,12,'rgba(120,108,151,.34)');
  if(p.fraction>0){const gradient=ctx.createLinearGradient(43,0,1037,0);gradient.addColorStop(0,C.purple);gradient.addColorStop(1,C.lime);round(ctx,43,257,Math.max(12,994*p.fraction),23,12,gradient);}
  text(ctx,`${fmt(p.current)} / ${fmt(p.required)} XP DO NASTĘPNEGO POZIOMU`,44,308,16,C.muted,true);
  text(ctx,`${fmt(row.xp)} XP ŁĄCZNIE`,43,344,15,C.white,true);
  return cv.toBuffer('image/png');
}

export async function economyCard(user,row,rank,inventory=[]){
  const {cv,ctx}=base(1080,475,'EKONOMIA / PORTFEL');
  await avatar(ctx,user,117,169,65);
  text(ctx,user.name,220,142,32,C.white,true,780);
  text(ctx,'TWÓJ SKARBIEC',220,182,16,C.purple,true);
  round(ctx,32,277,650,141,20,'rgba(32,30,52,.92)',C.border);
  text(ctx,'SALDO KONTA',58,317,15,C.muted,true);
  text(ctx,`${fmt(row.balance)}  ◈`,58,379,48,C.lime,true,600);
  metric(ctx,708,277,338,'Miejsce w rankingu',`#${rank}`,C.pink);
  text(ctx,`PRZEDMIOTY W PLECAKU: ${inventory.reduce((s,i)=>s+i.quantity,0)}`,710,407,13,C.muted,true);
  text(ctx,'/daily    /praca    /sklep    /przelew',34,452,14,C.muted,true);
  return cv.toBuffer('image/png');
}

export async function topCard(rows,users,kind='xp'){
  const {cv,ctx}=base(1080,174+rows.length*69,kind==='xp'?'TABLICA CHWAŁY / POZIOMY':'TABLICA CHWAŁY / MONETY');
  text(ctx,kind==='xp'?'TOP DOŚWIADCZENIA':'TOP BOGACTWA',39,112,32,C.white,true);
  for(let i=0;i<rows.length;i++){
    const y=140+i*69;const row=rows[i];const usr=users[i]||{name:`Użytkownik ${row.user_id.slice(-5)}`};
    round(ctx,35,y,1010,60,13,i<3?'rgba(47,39,72,.9)':'rgba(27,27,42,.91)',i<3?'rgba(180,127,255,.34)':C.border);
    text(ctx,`#${String(i+1).padStart(2,'0')}`,55,y+39,21,i===0?C.lime:C.purple,true);
    await avatar(ctx,usr,156,y+30,19);
    text(ctx,usr.name,196,y+39,18,C.white,true,525);
    text(ctx,kind==='xp'?`LV ${levelForXp(row.xp)}  •  ${fmt(row.xp)} XP`:`${fmt(row.balance)} ◈`,735,y+39,18,C.lime,true,280);
  }
  return cv.toBuffer('image/png');
}

export async function welcomeCard(user,memberCount){
  const {cv,ctx}=base(1080,405,'NOWY GRACZ / WITAJ');
  await avatar(ctx,user,158,208,86);
  text(ctx,'WITAJ W SPOŁECZNOŚCI',292,150,27,C.purple,true);
  text(ctx,user.name,290,219,38,C.white,true,730);
  text(ctx,`Jesteś osobą numer #${fmt(memberCount)} na serwerze.`,291,268,18,C.muted,false,730);
  text(ctx,'ROZGOŚĆ SIĘ  ◆  ZBIERAJ XP  ◆  BUDUJ SWOJĄ LEGENDĘ',290,318,14,C.lime,true,745);
  return cv.toBuffer('image/png');
}

export const userForCard = member => ({
  name: member.displayName || member.globalName || member.username,
  username: member.user?.username || member.username,
  avatarURL: member.displayAvatarURL?.({ extension: 'png', size: 256 }) || member.user?.displayAvatarURL?.({extension:'png',size:256}),
});
