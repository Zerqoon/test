import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { BRAND, fmt } from './ui.js';
const fonts=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../assets/fonts');
GlobalFonts.registerFromPath(path.join(fonts,'DejaVuSans.ttf'),'WZ');
GlobalFonts.registerFromPath(path.join(fonts,'DejaVuSans-Bold.ttf'),'WZ Bold');
export const themes={
  default:{accent:'#AE8BFF',bright:'#E5D9FF',deep:'#6540A5',panel:'#171320',bg:'#09080D',name:'Wymiar'},
  amethyst:{accent:'#C5ABFF',bright:'#F1E9FF',deep:'#8157C2',panel:'#201729',bg:'#0E0913',name:'Ametyst'},
  obsidian:{accent:'#C9C4D7',bright:'#FFFFFF',deep:'#656073',panel:'#18161D',bg:'#07070A',name:'Obsydian'},
  eclipse:{accent:'#C37DFF',bright:'#F0D8FF',deep:'#8528B7',panel:'#201227',bg:'#100915',name:'Zaćmienie'},
};
export const muted='#A49BAF',white='#F7F5FD';
export function box(ctx,x,y,w,h,{radius=20,fill='#15121C',stroke='#332B40',shadow=false}={}){
  ctx.save();if(shadow){ctx.shadowBlur=32;ctx.shadowColor='#00000070';ctx.shadowOffsetY=10;}
  ctx.beginPath();ctx.roundRect(x,y,w,h,radius);ctx.fillStyle=fill;ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  if(stroke){ctx.lineWidth=1;ctx.strokeStyle=stroke;ctx.stroke();}ctx.restore();
}
export function text(ctx,value,x,y,size=18,color=white,bold=false,max=0,align='left'){
  ctx.font=`${size}px '${bold?'WZ Bold':'WZ'}'`;ctx.fillStyle=color;ctx.textBaseline='alphabetic';ctx.textAlign=align;
  const chars=Array.from(String(value??'—').replace(/[\r\n\t]/g,' '));
  if(max&&ctx.measureText(chars.join('')).width>max){while(chars.length&&ctx.measureText(chars.join('')+'…').width>max)chars.pop();chars.push('…');}
  ctx.fillText(chars.join(''),x,y);ctx.textAlign='left';
}
export function fit(ctx,value,x,y,size,max,color=white,align='left'){
  while(size>19){ctx.font=`${size}px 'WZ Bold'`;if(ctx.measureText(String(value)).width<=max)break;size--;}
  text(ctx,value,x,y,size,color,true,max,align);
}
export function wrap(ctx,value,x,y,width,size=18,color=muted,lines=3){
  const words=String(value).split(/\s+/);let line='',n=0;
  ctx.font=`${size}px 'WZ'`;
  while(words.length&&n<lines){
    const word=words.shift();
    if(ctx.measureText(`${line} ${word}`.trim()).width>width&&line){text(ctx,line,x,y+n*(size+10),size,color,false,width);n++;line=word;}else line=`${line} ${word}`.trim();
  }
  if(n<lines)text(ctx,line+(words.length?'…':''),x,y+n*(size+10),size,color,false,width);
}
export function line(ctx,x,y,x2,y2,color='#332A41'){
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=1;ctx.stroke();
}
export function glow(ctx,x,y,r,color='#AA71FF'){
  const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`${color}32`);g.addColorStop(1,`${color}00`);ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
}
export function polygon(ctx,points,fill,stroke){ctx.beginPath();points.forEach(([x,y],n)=>n?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
export function artifact(ctx,type,x,y,size,c){
  ctx.save();ctx.translate(x,y);ctx.scale(size/100,size/100);glow(ctx,0,0,95,c.accent);
  ctx.lineWidth=2;ctx.strokeStyle=c.accent;
  if(type==='crystal'){
    polygon(ctx,[[0,-68],[46,-28],[34,35],[0,70],[-34,35],[-46,-28]],c.deep,`${c.accent}99`);
    polygon(ctx,[[0,-68],[46,-28],[0,-9]],c.bright);polygon(ctx,[[0,-68],[-46,-28],[0,-9]],c.accent);
    polygon(ctx,[[0,-9],[46,-28],[34,35],[0,70]],c.deep);polygon(ctx,[[0,-9],[-46,-28],[-34,35],[0,70]],c.accent);
    polygon(ctx,[[0,-9],[34,35],[0,70]],'#B18EEC');line(ctx,0,-68,0,70,'#FFFFFF55');
  }else if(type==='crown'){
    polygon(ctx,[[-58,-30],[-28,-9],[0,-54],[28,-9],[58,-30],[43,31],[-43,31]],c.accent,c.bright);
    polygon(ctx,[[-43,31],[43,31],[38,46],[-38,46]],c.deep,c.accent);polygon(ctx,[[0,-21],[12,-2],[0,17],[-12,-2]],c.bright);
  }else if(type==='bolt'){
    polygon(ctx,[[8,-65],[-45,9],[-7,9],[-15,62],[48,-17],[12,-17],[26,-65]],c.accent,c.bright);
    polygon(ctx,[[8,-65],[-45,9],[-7,9],[11,-11]],c.bright);
  }else if(type==='bank'){
    polygon(ctx,[[0,-61],[63,-27],[-63,-27]],c.accent,c.bright);
    for(const dx of [-36,0,36])box(ctx,dx-8,-17,16,59,{radius:3,fill:c.accent,stroke:null});box(ctx,-65,47,130,15,{radius:3,fill:c.bright,stroke:null});
  }else if(type==='coin'){
    ctx.beginPath();ctx.ellipse(0,0,56,63,-.2,0,Math.PI*2);ctx.fillStyle=c.deep;ctx.fill();ctx.strokeStyle=c.accent;ctx.stroke();
    ctx.beginPath();ctx.ellipse(-5,-3,43,50,-.2,0,Math.PI*2);ctx.strokeStyle=c.bright;ctx.stroke();text(ctx,'Z',-4,20,55,c.bright,true,80,'center');
  }else if(type==='palette'){
    for(let n=2;n>=0;n--)box(ctx,-50+n*12,-54+n*12,87,90,{radius:13,fill:[c.deep,c.accent,c.bright][n],stroke:'#FFFFFF55'});
    polygon(ctx,[[-20,-15],[12,-15],[-9,11],[23,11],[23,20],[-24,20],[-24,10],[1,-7],[-20,-7]],c.deep);
  }else{
    for(let n=0;n<3;n++){ctx.beginPath();ctx.ellipse(0,0,62-n*8,35+n*9,-.7+n*.65,0,Math.PI*2);ctx.strokeStyle=n===0?c.bright:c.accent;ctx.stroke();}
    ctx.beginPath();ctx.arc(0,0,15,0,Math.PI*2);ctx.fillStyle=c.accent;ctx.fill();
  }
  ctx.restore();
}
export function surface(height,section,theme='default',footer='WYMIAR ZERQONA • TWOJA SPOŁECZNOŚĆ'){
  const cv=createCanvas(1440,height),ctx=cv.getContext('2d'),c=themes[theme]||themes.default;
  ctx.fillStyle=c.bg;ctx.fillRect(0,0,1440,height);glow(ctx,1230,80,580,c.accent);glow(ctx,60,height,370,c.deep);
  for(let y=108;y<height-50;y+=24)for(let x=32;x<1440;x+=24){ctx.fillStyle='#D6BBFF09';ctx.fillRect(x,y,1,1);}
  ctx.save();ctx.strokeStyle='#C4ACFF0C';ctx.lineWidth=1;for(let n=0;n<4;n++){ctx.beginPath();ctx.ellipse(1280,100,310+n*32,210+n*20,-.55,0,Math.PI*2);ctx.stroke();}ctx.restore();
  box(ctx,48,26,44,44,{radius:13,fill:c.accent,stroke:null});text(ctx,'Z',70,58,30,c.bg,true,36,'center');
  text(ctx,BRAND.wordmark,107,48,20,white,true);text(ctx,'SPOŁECZNOŚĆ • ROZWÓJ • KOLEKCJA',108,70,10,muted,true);
  text(ctx,section,1392,51,14,c.bright,true,700,'right');line(ctx,48,94,1392,94);
  line(ctx,48,height-43,1392,height-43);text(ctx,footer,48,height-18,11,muted,false,1040);
  text(ctx,'ZERQONA / 03',1392,height-18,11,c.accent,true,210,'right');return {cv,ctx,c};
}
export function panel(ctx,x,y,w,h,c,highlight=false){
  const g=ctx.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,highlight?`${c.deep}65`:c.panel);g.addColorStop(1,highlight?c.panel:'#100D17');
  box(ctx,x,y,w,h,{fill:g,stroke:highlight?`${c.accent}60`:'#3F344A',shadow:true});
  line(ctx,x+22,y+1,x+w-22,y+1,highlight?`${c.bright}40`:'#FFFFFF12');
}
export function pill(ctx,label,x,y,w,c){box(ctx,x,y,w,32,{radius:8,fill:`${c.deep}50`,stroke:`${c.accent}55`});text(ctx,label,x+12,y+22,12,c.bright,true,w-24);}
export function bar(ctx,x,y,w,f,c,h=12){
  box(ctx,x,y,w,h,{radius:h/2,fill:'#FFFFFF12',stroke:null});
  if(f>0){const g=ctx.createLinearGradient(x,y,x+w,y);g.addColorStop(0,c.deep);g.addColorStop(1,c.bright);box(ctx,x,y,Math.max(h,w*Math.min(1,f)),h,{radius:h/2,fill:g,stroke:null});}
}
export function metric(ctx,x,y,w,h,label,value,note,c,icon='coin'){
  panel(ctx,x,y,w,h,c);artifact(ctx,icon,x+w-38,y+34,18,c);text(ctx,label,x+22,y+34,12,muted,true,w-76);fit(ctx,value,x+20,y+83,35,w-42);if(note)text(ctx,note,x+22,y+h-20,12,muted,false,w-44);
}
const cache=new Map(),pending=new Map();
export async function avatarImage(url){
  if(!url)return null;let u;try{u=new URL(url);}catch{return null;}
  if(u.protocol!=='https:'||!['cdn.discordapp.com','cdn.discord.com','media.discordapp.net'].includes(u.hostname))return null;
  const hit=cache.get(url);if(hit?.until>Date.now())return hit.image;if(pending.has(url))return pending.get(url);
  const task=(async()=>{try{
    const res=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(3500)});if(!res.ok||Number(res.headers.get('content-length'))>2000000)return null;
    const chunks=[];let bytes=0;for await(const chunk of res.body){bytes+=chunk.length;if(bytes>2000000)return null;chunks.push(chunk);}
    const image=await loadImage(Buffer.concat(chunks));if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(url,{image,until:Date.now()+900000});return image;
  }catch{return null;}finally{pending.delete(url);}})();pending.set(url,task);return task;
}
export function avatar(ctx,user,x,y,r,c,image,frame='default'){
  ctx.save();glow(ctx,x,y,r*1.8,c.accent);
  ctx.beginPath();ctx.arc(x,y,r+8,0,Math.PI*2);ctx.strokeStyle=c.accent;ctx.lineWidth=2;ctx.stroke();
  if(frame==='orbit'){for(let n=0;n<2;n++){ctx.beginPath();ctx.ellipse(x,y,r+26,r+10,.4+n*1.1,0,Math.PI*2);ctx.strokeStyle=`${c.accent}A0`;ctx.stroke();}}
  if(frame==='crystal')for(let n=0;n<8;n++){const a=n*Math.PI/4;polygon(ctx,[[x+Math.cos(a)*(r+17),y+Math.sin(a)*(r+17)],[x+Math.cos(a+.06)*(r+31),y+Math.sin(a+.06)*(r+31)],[x+Math.cos(a+.12)*(r+17),y+Math.sin(a+.12)*(r+17)]],c.bright);}
  if(frame==='crown')artifact(ctx,'crown',x,y-r-22,23,c);
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.clip();const g=ctx.createLinearGradient(x-r,y-r,x+r,y+r);g.addColorStop(0,c.deep);g.addColorStop(1,c.panel);ctx.fillStyle=g;ctx.fillRect(x-r,y-r,2*r,2*r);
  if(image)ctx.drawImage(image,x-r,y-r,2*r,2*r);else text(ctx,Array.from(user.name||'Z')[0].toUpperCase(),x,y+r*.36,r,c.bright,true,r*1.7,'center');ctx.restore();
}
export function ring(ctx,x,y,r,f,c){
  ctx.lineWidth=8;ctx.lineCap='round';ctx.strokeStyle='#FFFFFF13';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
  if(f>0){ctx.strokeStyle=c.accent;ctx.beginPath();ctx.arc(x,y,r,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,f));ctx.stroke();}ctx.lineCap='butt';
}
export const png=cv=>cv.toBuffer('image/png');
export const num=fmt;
