import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { BRAND, fmt } from './ui.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fonts=path.join(root,'assets/fonts');
GlobalFonts.registerFromPath(path.join(fonts,'DejaVuSans.ttf'),'WZ');
GlobalFonts.registerFromPath(path.join(fonts,'DejaVuSans-Bold.ttf'),'WZ Bold');

export const themes={
  default:{accent:'#9B6CFF',bright:'#F4EDFF',deep:'#5B2F9A',panel:'#17131D',panel2:'#211729',bg:'#09080C',ink:'#F8F6FC',name:'Fiolet'},
  amethyst:{accent:'#BA91FF',bright:'#FFF8FF',deep:'#6F43B5',panel:'#1D1525',panel2:'#2B1B37',bg:'#0D0911',ink:'#FFFFFF',name:'Ametyst'},
  obsidian:{accent:'#D5D0DE',bright:'#FFFFFF',deep:'#696271',panel:'#151419',panel2:'#211F26',bg:'#070709',ink:'#FFFFFF',name:'Obsydian'},
  eclipse:{accent:'#C36EFF',bright:'#F7E8FF',deep:'#7D2EA9',panel:'#1D1124',panel2:'#2A1532',bg:'#0B0710',ink:'#FFFFFF',name:'Zaćmienie'},
};
export const muted='#B6ADBE',white='#FAF8FF';

function roughRectPath(ctx,x,y,w,h,r=18){
  const j=Math.max(1,Math.min(4,Math.round((w+h)/600)));
  ctx.beginPath();
  ctx.moveTo(x+r,y+j);ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w+j,y,x+w,y+r);
  ctx.lineTo(x+w-j,y+h-r);ctx.quadraticCurveTo(x+w,y+h+j,x+w-r,y+h);
  ctx.lineTo(x+r,y+h-j);ctx.quadraticCurveTo(x-j,y+h,x,y+h-r);
  ctx.lineTo(x+j,y+r);ctx.quadraticCurveTo(x,y-j,x+r,y+j);ctx.closePath();
}
export function box(ctx,x,y,w,h,{radius=20,fill='#15121C',stroke='#3A3144',shadow=false,lineWidth=1}={}){
  ctx.save();
  if(shadow){ctx.shadowBlur=24;ctx.shadowColor='#00000090';ctx.shadowOffsetY=9;}
  roughRectPath(ctx,x,y,w,h,radius);ctx.fillStyle=fill;ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  if(stroke){ctx.lineWidth=lineWidth;ctx.strokeStyle=stroke;ctx.stroke();}
  ctx.restore();
}
export function text(ctx,value,x,y,size=18,color=white,bold=false,max=0,align='left'){
  ctx.font=`${size}px '${bold?'WZ Bold':'WZ'}'`;ctx.fillStyle=color;ctx.textBaseline='alphabetic';ctx.textAlign=align;
  const chars=Array.from(String(value??'—').replace(/[\r\n\t]/g,' '));
  if(max&&ctx.measureText(chars.join('')).width>max){while(chars.length&&ctx.measureText(chars.join('')+'…').width>max)chars.pop();chars.push('…');}
  ctx.fillText(chars.join(''),x,y);ctx.textAlign='left';
}
export function fit(ctx,value,x,y,size,max,color=white,align='left'){
  while(size>18){ctx.font=`${size}px 'WZ Bold'`;if(ctx.measureText(String(value)).width<=max)break;size--;}
  text(ctx,value,x,y,size,color,true,max,align);
}
export function wrap(ctx,value,x,y,width,size=18,color=muted,lines=3){
  const words=String(value).split(/\s+/);let line='',n=0;ctx.font=`${size}px 'WZ'`;
  while(words.length&&n<lines){const word=words.shift();const next=`${line} ${word}`.trim();if(ctx.measureText(next).width>width&&line){text(ctx,line,x,y+n*(size+9),size,color,false,width);n++;line=word;}else line=next;}
  if(n<lines)text(ctx,line+(words.length?'…':''),x,y+n*(size+9),size,color,false,width);
}
export function line(ctx,x,y,x2,y2,color='#3A3042',width=1){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
export function glow(ctx,x,y,r,color='#9B6CFF'){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`${color}28`);g.addColorStop(1,`${color}00`);ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
export function polygon(ctx,points,fill,stroke){ctx.beginPath();points.forEach(([x,y],n)=>n?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}

function doodleStroke(ctx,c,width=7){ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=c.bright;}
function doodleFill(ctx,c){ctx.fillStyle=c.accent;}
function circle(ctx,x,y,r,fill,stroke=null,width=2){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
function drawCoin(ctx,c){circle(ctx,0,0,57,c.deep,c.bright,7);circle(ctx,-3,-2,40,'#00000000',c.accent,5);text(ctx,'Z',0,22,60,c.bright,true,90,'center');}
function drawBank(ctx,c){doodleStroke(ctx,c,8);polygon(ctx,[[-62,-30],[0,-65],[62,-30]],c.accent,c.bright);for(const dx of [-36,0,36]){ctx.beginPath();ctx.moveTo(dx,-20);ctx.lineTo(dx,35);ctx.stroke();}ctx.beginPath();ctx.moveTo(-66,45);ctx.lineTo(66,45);ctx.stroke();}
function drawBriefcase(ctx,c){doodleStroke(ctx,c,8);doodleFill(ctx,c);box(ctx,-58,-25,116,72,{radius:14,fill:c.deep,stroke:c.bright,lineWidth:7});box(ctx,-25,-53,50,28,{radius:10,fill:'#00000000',stroke:c.bright,lineWidth:7});line(ctx,-56,2,56,2,c.bright,7);circle(ctx,0,3,7,c.accent,c.bright,4);}
function drawClock(ctx,c){doodleStroke(ctx,c,8);circle(ctx,0,0,55,c.deep,c.bright,8);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-30);ctx.moveTo(0,0);ctx.lineTo(24,13);ctx.stroke();}
function drawTicket(ctx,c){doodleStroke(ctx,c,6);polygon(ctx,[[-60,-35],[-20,-35],[-10,-22],[10,-22],[20,-35],[60,-35],[60,35],[20,35],[10,22],[-10,22],[-20,35],[-60,35]],c.deep,c.bright);line(ctx,-10,-24,-10,24,c.accent,5);}
function drawCrown(ctx,c){doodleStroke(ctx,c,7);polygon(ctx,[[-60,-27],[-32,-5],[-8,-50],[13,-5],[56,-31],[43,33],[-44,33]],c.accent,c.bright);line(ctx,-42,43,42,43,c.bright,8);}
function drawBag(ctx,c){doodleStroke(ctx,c,7);box(ctx,-48,-28,96,78,{radius:17,fill:c.deep,stroke:c.bright,lineWidth:7});ctx.beginPath();ctx.arc(0,-25,24,Math.PI,0);ctx.stroke();}
function drawBrush(ctx,c){doodleStroke(ctx,c,7);ctx.beginPath();ctx.moveTo(-45,45);ctx.lineTo(26,-28);ctx.stroke();polygon(ctx,[[25,-30],[55,-56],[65,-45],[38,-14]],c.accent,c.bright);polygon(ctx,[[-52,52],[-24,41],[-38,26]],c.deep,c.bright);}
function drawFrame(ctx,c){doodleStroke(ctx,c,7);box(ctx,-58,-58,116,116,{radius:18,fill:'#00000000',stroke:c.bright,lineWidth:7});box(ctx,-39,-39,78,78,{radius:15,fill:c.deep,stroke:c.accent,lineWidth:5});}
function drawTrophy(ctx,c){doodleStroke(ctx,c,7);box(ctx,-38,-48,76,58,{radius:13,fill:c.accent,stroke:c.bright,lineWidth:7});ctx.beginPath();ctx.moveTo(-38,-35);ctx.quadraticCurveTo(-70,-35,-59,-3);ctx.quadraticCurveTo(-50,18,-30,6);ctx.moveTo(38,-35);ctx.quadraticCurveTo(70,-35,59,-3);ctx.quadraticCurveTo(50,18,30,6);ctx.moveTo(0,10);ctx.lineTo(0,39);ctx.moveTo(-31,49);ctx.lineTo(31,49);ctx.stroke();}
function drawBolt(ctx,c){polygon(ctx,[[9,-64],[-45,8],[-8,8],[-17,62],[49,-17],[13,-17],[27,-64]],c.accent,c.bright);}
function drawChat(ctx,c){doodleStroke(ctx,c,7);box(ctx,-57,-42,114,77,{radius:19,fill:c.deep,stroke:c.bright,lineWidth:7});polygon(ctx,[[-18,33],[-34,60],[3,37]],c.deep,c.bright);for(const dx of [-24,0,24])circle(ctx,dx,-3,5,c.accent);}
function drawHeadset(ctx,c){doodleStroke(ctx,c,7);ctx.beginPath();ctx.arc(0,0,50,Math.PI,0);ctx.stroke();box(ctx,-61,-6,20,49,{radius:8,fill:c.accent,stroke:c.bright,lineWidth:6});box(ctx,41,-6,20,49,{radius:8,fill:c.accent,stroke:c.bright,lineWidth:6});}
function drawStar(ctx,c){const pts=[];for(let n=0;n<10;n++){const a=-Math.PI/2+n*Math.PI/5,r=n%2?25:59;pts.push([Math.cos(a)*r,Math.sin(a)*r]);}polygon(ctx,pts,c.accent,c.bright);}
function drawGift(ctx,c){doodleStroke(ctx,c,7);box(ctx,-55,-20,110,72,{radius:10,fill:c.deep,stroke:c.bright,lineWidth:7});line(ctx,0,-20,0,52,c.accent,8);line(ctx,-55,2,55,2,c.accent,8);ctx.beginPath();ctx.moveTo(0,-21);ctx.quadraticCurveTo(-35,-65,-48,-34);ctx.quadraticCurveTo(-58,-11,0,-12);ctx.moveTo(0,-21);ctx.quadraticCurveTo(35,-65,48,-34);ctx.quadraticCurveTo(58,-11,0,-12);ctx.stroke();}
function drawShield(ctx,c){polygon(ctx,[[0,-62],[53,-39],[45,19],[0,63],[-45,19],[-53,-39]],c.deep,c.bright);doodleStroke(ctx,c,7);ctx.beginPath();ctx.moveTo(-25,0);ctx.lineTo(-7,19);ctx.lineTo(31,-22);ctx.stroke();}
function drawOrbit(ctx,c){doodleStroke(ctx,c,5);for(let n=0;n<3;n++){ctx.beginPath();ctx.ellipse(0,0,60-n*5,31+n*7,-.8+n*.66,0,Math.PI*2);ctx.strokeStyle=n===0?c.bright:c.accent;ctx.stroke();}circle(ctx,0,0,13,c.accent,c.bright,4);}

export function artifact(ctx,type,x,y,size,c){
  const mapped=type==='crystal'?'star':type;ctx.save();ctx.translate(x,y);ctx.scale(size/100,size/100);glow(ctx,0,0,92,c.accent);
  ({coin:drawCoin,bank:drawBank,briefcase:drawBriefcase,work:drawBriefcase,clock:drawClock,ticket:drawTicket,crown:drawCrown,bag:drawBag,package:drawBag,palette:drawBrush,brush:drawBrush,frame:drawFrame,trophy:drawTrophy,bolt:drawBolt,chat:drawChat,headset:drawHeadset,star:drawStar,gift:drawGift,shield:drawShield,orbit:drawOrbit}[mapped]||drawStar)(ctx,c);
  ctx.restore();
}

function scribble(ctx,c,height){
  ctx.save();ctx.globalAlpha=.28;ctx.strokeStyle=c.accent;ctx.lineWidth=3;ctx.lineCap='round';
  for(let n=0;n<5;n++){ctx.beginPath();const y=132+n*23;ctx.moveTo(1015,y);ctx.bezierCurveTo(1100,y-30,1190,y+35,1385,y-10);ctx.stroke();}
  ctx.globalAlpha=.12;ctx.fillStyle=white;for(let n=0;n<90;n++){const x=(n*137)%1420+10,y=(n*83)%Math.max(120,height-120)+105;ctx.fillRect(x,y,1+(n%3===0),1+(n%4===0));}
  ctx.restore();
}
export function surface(height,section,theme='default',footer='WYMIAR ZERQONA • COMMUNITY SYSTEM'){
  const cv=createCanvas(1440,height),ctx=cv.getContext('2d'),c=themes[theme]||themes.default;
  ctx.fillStyle=c.bg;ctx.fillRect(0,0,1440,height);glow(ctx,1240,90,500,c.accent);glow(ctx,120,height-25,360,c.deep);scribble(ctx,c,height);
  box(ctx,46,24,51,51,{radius:15,fill:c.accent,stroke:c.bright,lineWidth:3,shadow:true});text(ctx,'Z',71.5,61,32,c.bg,true,42,'center');
  text(ctx,BRAND.wordmark,114,49,21,white,true);text(ctx,'BOT SPOŁECZNOŚCIOWY • EKONOMIA • LEVELING',114,72,10,muted,true);
  box(ctx,1010,28,382,42,{radius:14,fill:'#110E16',stroke:`${c.accent}70`,lineWidth:2});text(ctx,section,1371,55,13,c.bright,true,338,'right');
  line(ctx,48,96,1392,96,'#FFFFFF1A',2);
  line(ctx,48,height-43,1392,height-43,'#FFFFFF16',2);text(ctx,footer,48,height-18,11,muted,false,1040);text(ctx,`ZERQONA / ${BRAND.version}`,1392,height-18,11,c.accent,true,260,'right');
  return {cv,ctx,c};
}
export function panel(ctx,x,y,w,h,c,highlight=false){
  const fill=highlight?c.panel2:c.panel;box(ctx,x,y,w,h,{radius:20,fill,stroke:highlight?c.accent:'#3E3547',shadow:true,lineWidth:highlight?2:1});
  if(highlight){line(ctx,x+25,y+2,x+w-25,y+2,c.bright,2);box(ctx,x+17,y+15,8,8,{radius:4,fill:c.accent,stroke:null});}
}
export function pill(ctx,label,x,y,w,c){box(ctx,x,y,w,34,{radius:11,fill:'#0F0C14',stroke:`${c.accent}AA`,lineWidth:2});text(ctx,label,x+14,y+23,12,c.bright,true,w-28);}
export function bar(ctx,x,y,w,f,c,h=12){box(ctx,x,y,w,h,{radius:h/2,fill:'#FFFFFF14',stroke:'#FFFFFF10'});if(f>0){box(ctx,x,y,Math.max(h,w*Math.min(1,f)),h,{radius:h/2,fill:c.accent,stroke:c.bright,lineWidth:1});}}
export function metric(ctx,x,y,w,h,label,value,note,c,icon='coin'){panel(ctx,x,y,w,h,c);artifact(ctx,icon,x+w-40,y+37,20,c);text(ctx,label,x+22,y+36,12,muted,true,w-80);fit(ctx,value,x+20,y+84,35,w-42);if(note)text(ctx,note,x+22,y+h-19,12,muted,false,w-44);}

const cache=new Map(),pending=new Map();
export async function avatarImage(url){
  if(!url)return null;let u;try{u=new URL(url);}catch{return null;}
  if(u.protocol!=='https:'||!['cdn.discordapp.com','cdn.discord.com','media.discordapp.net'].includes(u.hostname))return null;
  const hit=cache.get(url);if(hit?.until>Date.now())return hit.image;if(pending.has(url))return pending.get(url);
  const task=(async()=>{try{const res=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(3500)});if(!res.ok||Number(res.headers.get('content-length'))>2000000)return null;const chunks=[];let bytes=0;for await(const chunk of res.body){bytes+=chunk.length;if(bytes>2000000)return null;chunks.push(chunk);}const image=await loadImage(Buffer.concat(chunks));if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(url,{image,until:Date.now()+900000});return image;}catch{return null;}finally{pending.delete(url);}})();pending.set(url,task);return task;
}
export function avatar(ctx,user,x,y,r,c,image,frame='default'){
  ctx.save();glow(ctx,x,y,r*1.9,c.accent);circle(ctx,x,y,r+10,c.panel,c.accent,4);
  if(frame==='orbit'){ctx.lineWidth=3;for(let n=0;n<2;n++){ctx.beginPath();ctx.ellipse(x,y,r+26,r+11,.4+n*1.1,0,Math.PI*2);ctx.strokeStyle=n?c.bright:c.accent;ctx.stroke();}}
  if(frame==='crystal'||frame==='sketch'){for(let n=0;n<8;n++){const a=n*Math.PI/4;circle(ctx,x+Math.cos(a)*(r+20),y+Math.sin(a)*(r+20),5,n%2?c.accent:c.bright);}}
  if(frame==='crown')artifact(ctx,'crown',x,y-r-26,24,c);
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.clip();ctx.fillStyle=c.panel2;ctx.fillRect(x-r,y-r,2*r,2*r);if(image)ctx.drawImage(image,x-r,y-r,2*r,2*r);else text(ctx,Array.from(user.name||'Z')[0].toUpperCase(),x,y+r*.36,r,c.bright,true,r*1.7,'center');ctx.restore();
}
export function ring(ctx,x,y,r,f,c){ctx.lineWidth=10;ctx.lineCap='round';ctx.strokeStyle='#FFFFFF18';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();if(f>0){ctx.strokeStyle=c.accent;ctx.beginPath();ctx.arc(x,y,r,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,f));ctx.stroke();}ctx.lineCap='butt';}
export const png=cv=>cv.toBuffer('image/png');
export const num=fmt;
