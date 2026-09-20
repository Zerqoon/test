import { progressForXp, levelForXp } from './level.js';
import { config } from './config.js';
import { fmt, duration } from './ui.js';
import { items, permanent, rarityNames, shopCategories } from './shop.js';
import { surface,panel,text,fit,wrap,line,pill,bar,metric,artifact,avatarImage,avatar,ring,png,muted,white,themes,box } from './graphics.js';
export const userForCard=member=>({name:member.displayName||member.globalName||member.username||'Użytkownik',username:member.user?.username||member.username,avatarURL:member.displayAvatarURL?.({extension:'png',size:256})||member.user?.displayAvatarURL?.({extension:'png',size:256})});
const ready=(last,ms,now=Date.now())=>{
  const left=last+ms-now;if(!last||left<=0)return 'DO ODBIORU';
  const hours=Math.ceil(left/3600000);return hours>=24?`ZA ${Math.floor(hours/24)} d ${hours%24} h`:`ZA ${duration(Math.ceil(left/60000)*60)}`;
};
const activeStreak=(row,now=Date.now())=>row.last_daily_at&&now-row.last_daily_at<=config.economy.dailyGraceMs?row.daily_streak||0:0;
const countPermanent=inventory=>inventory.filter(r=>permanent(items[r.item_id])).length;
function milestones(ctx,x,y,w,xp,c){
  const current=levelForXp(xp),step=w/6;line(ctx,x+20,y+18,x+w-20,y+18,'#55415F');
  config.levelRoles.forEach((r,n)=>{const cx=x+step*n+step/2,done=current>=r.level;
    box(ctx,cx-18,y,36,36,{radius:10,fill:done?c.accent:'#241D2E',stroke:done?c.bright:'#59456B'});
    text(ctx,r.level,cx,y+24,14,done?c.bg:muted,true,32,'center');text(ctx,r.name,cx,y+61,11,done?c.bright:muted,true,step-10,'center');
  });
}
export async function profileCard(user,row,rank,roleName='Początkujący'){
  const {cv,ctx,c}=surface(920,'KARTA CZŁONKA / PROFIL',row.card_theme),p=progressForXp(row.xp),inventory=row.inventory||[],ach=row.achievements||[];
  panel(ctx,48,122,1344,300,c,true);avatar(ctx,user,191,258,84,c,await avatarImage(user.avatarURL),row.avatar_frame);
  pill(ctx,roleName.toUpperCase(),324,150,270,c);fit(ctx,user.name,322,234,46,755);text(ctx,`@${user.username||user.name}`,325,265,16,muted,false,700);
  text(ctx,row.title||'TWOJA HISTORIA DOPIERO SIĘ ZACZYNA',325,301,16,c.bright,true,710);
  text(ctx,`DO POZIOMU ${p.level+1}`,325,351,12,muted,true);text(ctx,`${fmt(p.current)} / ${fmt(p.required)} XP`,1044,351,15,c.bright,true,440,'right');
  bar(ctx,325,370,720,p.fraction,c,14);
  ring(ctx,1244,247,91,p.fraction,c);text(ctx,'POZIOM',1244,216,12,c.bright,true,140,'center');fit(ctx,p.level,1244,291,77,168,white,'center');
  text(ctx,`#${fmt(rank)} W RANKINGU XP`,1244,376,14,c.bright,true,225,'center');
  const metrics=[['PORTFEL',`${fmt(row.balance)} ZC`,'Monety do wykorzystania','coin'],['BANK',`${fmt(row.bank||0)} ZC`,'Odłożone monety','bank'],['WIADOMOŚCI',fmt(row.messages),'Wiadomości nagrodzone XP','chat'],['ROZMOWY VC',duration(row.voice_seconds),'Czas naliczony do XP','headset']];
  metrics.forEach((m,n)=>metric(ctx,48+n*344,450,312,140,m[0],m[1],m[2],c,m[3]));
  panel(ctx,48,618,848,219,c);text(ctx,'ŚCIEŻKA WYMIARU',72,654,14,c.bright,true);text(ctx,`${fmt(row.xp)} XP ŁĄCZNIE`,870,654,13,muted,true,390,'right');
  milestones(ctx,70,680,802,row.xp,c);line(ctx,72,761,872,761);
  text(ctx,`XP: ${row.multiplier||(row.booster_until>Date.now()?row.xp_multiplier||1.5:1)}×`,72,802,17,c.bright,true);
  text(ctx,row.work_boost_until>Date.now()?`PRACA: ${row.work_multiplier||1.5}×`:'PRACA: 1×',300,802,17,c.bright,true);
  text(ctx,`DAILY: ${activeStreak(row)} ODBIORÓW`,586,802,15,muted,true,280);
  panel(ctx,924,618,468,219,c);artifact(ctx,'crown',1316,687,39,c);
  text(ctx,'TWOJA KOLEKCJA',948,655,14,c.bright,true);text(ctx,`${countPermanent(inventory)} / ${Object.values(items).filter(permanent).length}`,946,707,39,white,true);
  text(ctx,'KOSMETYKÓW',948,734,11,muted,true);line(ctx,948,756,1368,756);
  text(ctx,`Osiągnięcia: ${ach.filter(a=>a.claimed).length} / ${ach.length||8}`,948,787,16,c.bright,true);
  text(ctx,`Motyw: ${(themes[row.card_theme]||themes.default).name}`,948,815,13,muted);
  return png(cv);
}
export async function rankCard(user,row,rank){
  const {cv,ctx,c}=surface(560,'ROZWÓJ / POZIOM I RANGA',row.card_theme),p=progressForXp(row.xp);
  panel(ctx,48,124,1344,348,c,true);avatar(ctx,user,173,249,75,c,await avatarImage(user.avatarURL),row.avatar_frame);
  text(ctx,'TWOJE MIEJSCE W WYMIARZE',299,172,12,c.bright,true);fit(ctx,user.name,296,234,42,739);
  text(ctx,`RANKING #${fmt(rank)}  •  ${fmt(row.xp)} XP ŁĄCZNIE`,300,276,16,muted,true,680);
  ring(ctx,1231,251,83,p.fraction,c);text(ctx,'POZIOM',1231,221,11,c.bright,true,140,'center');fit(ctx,p.level,1231,289,70,154,white,'center');
  text(ctx,`${fmt(p.current)} / ${fmt(p.required)} XP`,80,372,20,c.bright,true);text(ctx,`${Math.floor(p.fraction*100)}% DO KOLEJNEGO POZIOMU`,1358,372,13,muted,true,680,'right');
  bar(ctx,80,393,1278,p.fraction,c,20);text(ctx,`Jeszcze ${fmt(p.required-p.current)} XP do poziomu ${p.level+1}`,80,446,17,white);
  return png(cv);
}
function cashChart(ctx,x,y,w,h,days,c){
  const data=days?.length?days:Array.from({length:7},(_,i)=>({label:String(i+1),income:0,expense:0}));
  const max=Math.max(1,...data.flatMap(d=>[d.income,d.expense])),plot=h-43,step=w/7;
  text(ctx,`SKALA 0–${fmt(max)} ZC`,x+w,y-13,10,muted,false,w,'right');
  for(let n=0;n<4;n++){const py=y+plot*n/3;line(ctx,x,py,x+w,py,'#FFFFFF0D');}
  data.forEach((d,n)=>{const dx=x+n*step+step/2,iw=Math.min(22,step*.22);for(const [v,ox,color] of [[d.income,-iw-3,c.accent],[d.expense,3,'#716277']]){
    const bh=v?Math.max(3,plot*v/max):2;box(ctx,dx+ox,y+plot-bh,iw,bh,{radius:Math.min(5,bh/2),fill:color,stroke:null});
  }text(ctx,d.label,dx,y+h-15,12,muted,false,step-4,'center');});
}
export async function economyCard(user,row,rank,inventory=[],now=Date.now()){
  const {cv,ctx,c}=surface(990,'EKONOMIA / PORTFEL',row.card_theme,'WIRTUALNE MONETY • BANK BEZ ODSETEK • HISTORIA OD WERSJI 2.0'),stats=row.stats||{},wealth=row.balance+(row.bank||0);
  avatar(ctx,user,77,139,22,c,await avatarImage(user.avatarURL));text(ctx,user.name,118,145,23,white,true,790);text(ctx,`RANKING PORTFELA #${fmt(rank)}`,1392,145,13,c.bright,true,450,'right');
  panel(ctx,48,181,655,247,c,true);text(ctx,'TWÓJ PORTFEL',78,224,13,c.bright,true);fit(ctx,fmt(row.balance),74,327,75,510);artifact(ctx,'coin',634,289,44,c);
  text(ctx,'MONET GOTOWYCH DO UŻYCIA',78,376,12,muted,true);pill(ctx,`SERIA DAILY: ${activeStreak(row,now)}`,440,353,226,c);
  metric(ctx,731,181,315,247,'BANK',fmt(row.bank||0),'',c,'bank');
  text(ctx,'/bank wplac • /bank wyplac',753,298,12,muted);text(ctx,'Portfel + bank',1096,298,12,muted);
  text(ctx,'UDZIAŁ OSZCZĘDNOŚCI',753,338,10,muted,true);bar(ctx,753,354,271,wealth?(row.bank||0)/wealth:0,c);text(ctx,`${wealth?Math.round((row.bank||0)/wealth*100):0}% majątku`,753,393,13,c.bright);
  metric(ctx,1074,181,318,247,'CAŁY MAJĄTEK',fmt(wealth),'',c,'bag');
  text(ctx,'KOSMETYKI',1096,338,10,muted,true);text(ctx,String(countPermanent(inventory)),1096,390,34,c.bright,true);
  panel(ctx,48,456,850,286,c);text(ctx,'PRZEPŁYW PORTFELA / 7 DNI',74,493,14,c.bright,true);text(ctx,'WPŁYWY',646,493,10,c.accent,true);text(ctx,'WYDATKI',772,493,10,'#A795B0',true);
  cashChart(ctx,76,530,792,186,stats.days,c);
  panel(ctx,926,456,466,286,c);text(ctx,'BILANS AKTYWNOŚCI',950,493,14,c.bright,true);
  [['Zarobione nagrody',stats.earned||0],['Zakupy w sklepie',stats.spent||0],['Wynik gier',stats.games||0]].forEach(([label,value],n)=>{text(ctx,label,950,544+n*59,14,muted);text(ctx,`${fmt(value)} ZC`,1366,544+n*59,20,white,true,227,'right');if(n<2)line(ctx,950,562+n*59,1366,562+n*59);});
  text(ctx,`${stats.transactions||0} operacji od uruchomienia historii`,950,716,11,muted,false,412);
  const reward=[['/daily',ready(row.last_daily_at,config.economy.dailyCooldownMs,now),'350–650 ZC • co 24 godziny'],['/praca',ready(row.last_work_at,config.economy.workCooldownMs,now),row.work_boost_until>now?'150–360 ZC • kontrakt aktywny':'100–240 ZC • co 45 minut'],['/weekly',ready(row.last_weekly_at,config.economy.weeklyCooldownMs,now),'1200 ZC • co 7 dni']];
  reward.forEach(([label,status,note],n)=>{const x=48+n*458;panel(ctx,x,770,428,139,c);text(ctx,label,x+22,808,22,white,true);text(ctx,status,x+406,808,12,c.bright,true,220,'right');text(ctx,note,x+22,844,14,muted);const last=[row.last_daily_at,row.last_work_at,row.last_weekly_at][n]||0,cd=[config.economy.dailyCooldownMs,config.economy.workCooldownMs,config.economy.weeklyCooldownMs][n];bar(ctx,x+22,871,384,last?Math.max(0,Math.min(1,(now-last)/cd)):1,c,5);});
  return png(cv);
}
export async function topCard(rows,users,kind='xp',offset=0,total=rows.length){
  const labels={xp:'DOŚWIADCZENIE',balance:'PORTFEL',wealth:'CAŁY MAJĄTEK',bank:'OSZCZĘDNOŚCI',messages:'WIADOMOŚCI',voice_seconds:'ROZMOWY VC'};
  const {cv,ctx,c}=surface(288+rows.length*78,`RANKING / ${labels[kind]||labels.xp}`);
  text(ctx,'TABLICA CHWAŁY',48,157,38,white,true);text(ctx,`MIEJSCA ${offset+1}–${offset+rows.length} / ${fmt(total)}`,1392,155,13,muted,true,570,'right');
  const images=await Promise.all(users.map(u=>avatarImage(u.avatarURL)));
  rows.forEach((row,n)=>{const y=191+n*78,user=users[n]||{name:'Użytkownik'},pos=offset+n+1;panel(ctx,48,y,1344,66,c,pos<=3);
    text(ctx,String(pos).padStart(2,'0'),78,y+43,23,pos<=3?c.bright:muted,true,72);avatar(ctx,user,185,y+33,20,c,images[n]);text(ctx,user.name,227,y+41,21,white,true,612);
    const val=kind==='xp'?`LV ${levelForXp(row.xp)}   /   ${fmt(row.xp)} XP`:kind==='voice_seconds'?duration(row.voice_seconds):kind==='messages'?`${fmt(row.messages)} WIAD.`:`${fmt(kind==='wealth'?row.balance+(row.bank||0):row[kind]||0)} ZC`;
    text(ctx,val,1365,y+41,21,c.bright,true,470,'right');
  });return png(cv);
}
export async function welcomeCard(user,count){
  const {cv,ctx,c}=surface(530,'WITAJ / NOWA OSOBA');panel(ctx,48,122,1344,305,c,true);
  avatar(ctx,user,204,272,87,c,await avatarImage(user.avatarURL),'orbit');text(ctx,'WITAJ W WYMIARZE ZERQONA',365,192,19,c.bright,true);fit(ctx,user.name,361,267,53,960);
  text(ctx,`Dołączasz do społeczności ${fmt(count)} osób. Rozgość się!`,366,311,20,muted,false,950);pill(ctx,'POZNAWAJ LUDZI  •  ZDOBYWAJ XP  •  ROZWIJAJ PROFIL',366,350,835,c);return png(cv);
}
export async function shopCard(user,row,inventory,selected='xp_boost',category='all',page=1){
  const all=Object.entries(items).filter(([,it])=>category==='all'||it.category===category),pages=Math.max(1,Math.ceil(all.length/6));page=Math.max(1,Math.min(pages,page));
  const pageItems=all.slice((page-1)*6,page*6),item=items[selected]||pageItems[0]?.[1]||items.xp_boost;
  const owned=new Map(inventory.map(r=>[r.item_id,r.quantity]));
  const {cv,ctx,c}=surface(1050,'SKLEP WYMIARU / KOLEKCJA I WZMOCNIENIA',row.card_theme);
  panel(ctx,48,122,414,331,c,true);pill(ctx,rarityNames[item.rarity].toUpperCase(),73,145,190,c);artifact(ctx,item.icon,254,278,95,c);
  text(ctx,`${fmt(item.price)} ZC`,254,406,38,c.bright,true,351,'center');
  panel(ctx,490,122,902,331,c);text(ctx,'WYBRANY PRZEDMIOT',518,160,12,muted,true);fit(ctx,item.name,515,207,32,839);
  wrap(ctx,item.description,518,245,826,18,muted,3);
  line(ctx,518,320,1364,320);
  const info=[['RODZAJ',shopCategories[item.category]],['DZIAŁANIE',item.durationMs?duration(item.durationMs/1000):'Na stałe'],['W TWOIM PLECAKU',owned.has(selected)?(permanent(item)?'Posiadasz':`${owned.get(selected)} szt.`):'Nie posiadasz']];
  info.forEach(([label,value],n)=>{const x=518+n*285;text(ctx,label,x,353,10,muted,true);text(ctx,value,x,384,19,c.bright,true,265);});
  text(ctx,permanent(item)?'Kup raz. Zakładaj wielokrotnie.':'Aktywuj po zakupie. Ten sam mnożnik przedłuża czas.',518,429,13,muted,false,818);
  text(ctx,(shopCategories[category]||shopCategories.all).toUpperCase(),48,507,23,white,true);text(ctx,`PORTFEL ${fmt(row.balance)} ZC  •  STRONA ${page}/${pages}`,1392,506,15,c.bright,true,720,'right');
  pageItems.forEach(([id,it],n)=>{const x=48+(n%3)*458,y=537+Math.floor(n/3)*200,isSelected=id===selected;
    panel(ctx,x,y,428,176,c,isSelected);artifact(ctx,it.icon,x+60,y+79,35,c);text(ctx,rarityNames[it.rarity].toUpperCase(),x+115,y+30,9,c.accent,true);
    text(ctx,it.name,x+115,y+61,17,white,true,291);text(ctx,it.tag,x+115,y+88,10,muted,true,279);text(ctx,`${fmt(it.price)} ZC`,x+115,y+126,24,c.bright,true,270);
    text(ctx,owned.has(id)?(permanent(it)?'W KOLEKCJI':`PLECAK: ${owned.get(id)}`):'DOSTĘPNY W SKLEPIE',x+22,y+156,10,muted,true,310);
    if(isSelected)text(ctx,'◆',x+391,y+155,15,c.bright,true);
  });
  text(ctx,`Panel: ${user.name}`,48,975,12,muted,false,900);return png(cv);
}
export async function inventoryCard(user,row,inventory){
  const rows=inventory.filter(r=>items[r.item_id]),h=Math.max(470,275+Math.ceil(rows.length/3)*143),{cv,ctx,c}=surface(h,'KOLEKCJA / PLECAK',row.card_theme);
  text(ctx,'TWOJA KOLEKCJA',48,149,32,white,true);text(ctx,`${countPermanent(rows)} KOSMETYKÓW  /  ${rows.filter(r=>!permanent(items[r.item_id])).reduce((n,r)=>n+r.quantity,0)} BOOSTÓW`,1392,147,13,c.bright,true,700,'right');
  if(!rows.length){artifact(ctx,'bag',230,285,80,c);text(ctx,'Zacznij od pierwszego przedmiotu.',403,279,26,white,true);text(ctx,'Otwórz /sklep i wybierz coś dla siebie.',404,319,19,muted);}
  rows.forEach((r,n)=>{const item=items[r.item_id],x=48+(n%3)*458,y=183+Math.floor(n/3)*143;panel(ctx,x,y,428,124,c);artifact(ctx,item.icon,x+53,y+60,31,c);text(ctx,item.name,x+103,y+39,16,white,true,299);text(ctx,permanent(item)?'KOSMETYK • W KOLEKCJI':`${r.quantity} SZT. • ${duration(item.durationMs/1000)}`,x+103,y+68,11,c.accent,true,295);
    const active=item.type==='title'?row.title===item.title:item.type==='theme'?row.card_theme===item.theme:item.type==='frame'?row.avatar_frame===item.frame:false;text(ctx,active?'ZAŁOŻONY':'UŻYJ PRZEZ /uzyj',x+103,y+98,11,active?c.bright:muted,true,295);
  });return png(cv);
}
export async function bankCard(user,row){
  const {cv,ctx,c}=surface(650,'EKONOMIA / BANK',row.card_theme,'BANK PRZECHOWUJE WIRTUALNE MONETY. NIE NALICZA ODSETEK.'),wealth=row.balance+(row.bank||0);
  panel(ctx,48,123,1344,430,c,true);artifact(ctx,'bank',223,326,109,c);text(ctx,'TWÓJ SKARBIEC',406,181,16,c.bright,true);fit(ctx,`${fmt(row.bank||0)} ZC`,401,277,70,912);
  text(ctx,`Portfel: ${fmt(row.balance)} ZC`,407,328,24,white,true);text(ctx,`Cały majątek: ${fmt(wealth)} ZC`,407,368,20,muted);
  text(ctx,'ODŁOŻONA CZĘŚĆ MAJĄTKU',408,421,12,muted,true);bar(ctx,408,440,935,wealth?(row.bank||0)/wealth:0,c,17);
  text(ctx,'Wpłaty i wypłaty są natychmiastowe i bez prowizji.',407,502,17,c.bright,false,920);return png(cv);
}
export async function achievementsCard(user,row,status){
  const {cv,ctx,c}=surface(965,'ROZWÓJ / OSIĄGNIĘCIA',row.card_theme),claimed=status.filter(a=>a.claimed).length;
  text(ctx,'TWOJE OSIĄGNIĘCIA',48,153,33,white,true);text(ctx,`${claimed} / ${status.length} ODEBRANYCH`,1392,152,15,c.bright,true,500,'right');
  status.forEach((a,n)=>{const x=48+(n%2)*686,y=188+Math.floor(n/2)*175;panel(ctx,x,y,658,151,c,a.ready);artifact(ctx,a.claimed?'trophy':'star',x+57,y+69,32,c);
    text(ctx,a.name,x+111,y+36,21,white,true,514);text(ctx,a.description,x+112,y+66,13,muted,false,514);
    bar(ctx,x+112,y+91,387,a.progress/a.goal,c,9);text(ctx,`${fmt(a.progress)}/${fmt(a.goal)}`,x+628,y+99,12,c.bright,true,120,'right');
    text(ctx,a.claimed?'ODEBRANO':a.ready?'GOTOWE DO ODBIORU':'W TRAKCIE',x+112,y+131,11,a.ready?c.bright:muted,true,290);text(ctx,`+${fmt(a.reward)} ZC`,x+629,y+131,15,c.bright,true,250,'right');
  });return png(cv);
}

export async function rewardCard(user,row,{kind='work',baseReward=0,reward=0,balance=0,availableAt=0,streak=0,job=''}={}){
  const meta={
    work:{section:'EKONOMIA / PRACA',title:'WYPŁATA ZA PRACĘ',subtitle:job||'Zadanie wykonane. Wynagrodzenie trafiło do portfela.',icon:'briefcase',accent:'WYNAGRODZENIE'},
    daily:{section:'EKONOMIA / DAILY',title:'CODZIENNA WYPŁATA',subtitle:'Regularność zwiększa nagrodę aż do siódmego odbioru.',icon:'gift',accent:'NAGRODA DZIENNA'},
    weekly:{section:'EKONOMIA / WEEKLY',title:'TYGODNIOWA WYPŁATA',subtitle:'Nagroda za powrót do społeczności w kolejnym tygodniu.',icon:'trophy',accent:'NAGRODA TYGODNIOWA'},
  }[kind]||{};
  const {cv,ctx,c}=surface(560,meta.section,row.card_theme,'PUBLICZNA KARTA WYPŁATY • WIRTUALNA EKONOMIA SERWERA');
  panel(ctx,48,124,1344,346,c,true);
  avatar(ctx,user,151,214,57,c,await avatarImage(user.avatarURL),row.avatar_frame);
  text(ctx,user.name,230,191,24,white,true,570);text(ctx,meta.accent,230,221,11,c.accent,true,570);
  fit(ctx,meta.title,228,278,38,760);wrap(ctx,meta.subtitle,230,313,720,16,muted,2);
  artifact(ctx,meta.icon,1202,252,92,c);
  box(ctx,875,351,467,91,{radius:17,fill:'#0D0B11',stroke:`${c.accent}70`,lineWidth:2});
  text(ctx,'OTRZYMUJESZ',900,380,11,muted,true);fit(ctx,`+${fmt(reward)} ZC`,900,421,38,405,c.bright);
  const diff=Math.max(0,reward-baseReward);
  const labels=kind==='daily'?
    [['SERIA',`${streak} dni`],['BONUS SERII',diff?`+${fmt(diff)} ZC`:'—'],['PORTFEL',`${fmt(balance)} ZC`]]:
    kind==='work'?
      [['BAZA',`${fmt(baseReward)} ZC`],['BONUS',diff?`+${fmt(diff)} ZC`:'brak'],['PORTFEL',`${fmt(balance)} ZC`]]:
      [['WYPŁATA',`${fmt(reward)} ZC`],['PORTFEL',`${fmt(balance)} ZC`],['STATUS','odebrano']];
  labels.forEach(([label,value],n)=>{const x=74+n*250;text(ctx,label,x,384,10,muted,true,220);text(ctx,value,x,416,18,white,true,220);});
  text(ctx,'NASTĘPNY ODBIÓR',74,456,10,muted,true);text(ctx,availableAt?new Date(availableAt).toLocaleString('pl-PL',{timeZone:'Europe/Warsaw',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—',225,456,14,c.bright,true,350);
  return png(cv);
}
