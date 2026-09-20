import fs from 'node:fs';
import path from 'node:path';
import {profileCard,rankCard,economyCard,topCard,welcomeCard,shopCard,inventoryCard,bankCard,achievementsCard} from '../src/cards.js';
import { totalXpForLevel } from '../src/level.js';
import { achievements } from '../src/achievements.js';
const folder=path.resolve('previews');fs.mkdirSync(folder,{recursive:true});
const now=Date.now(),demo={name:'B3sttiee',username:'b3sttiee'};
const inventory=[{item_id:'xp_boost',quantity:3},{item_id:'work_boost',quantity:2},{item_id:'title_zerqon',quantity:1},{item_id:'title_void',quantity:1},{item_id:'theme_amethyst',quantity:1},{item_id:'frame_orbit',quantity:1},{item_id:'frame_crystal',quantity:1}];
const status=achievements.map((a,n)=>({...a,progress:n<3?a.goal:Math.floor(a.goal*.65),claimed:n<2,ready:n===2}));
const row={xp:totalXpForLevel(38)+1740,balance:48250,bank:125000,messages:4680,voice_seconds:3600*182+840,booster_until:now+2700000,xp_multiplier:1.5,work_boost_until:now+6000000,work_multiplier:1.5,daily_streak:6,best_daily_streak:6,last_daily_at:now-86400000,last_work_at:now-900000,last_weekly_at:now-604800000,multiplier:3,title:'STRAŻNIK WYMIARU',card_theme:'default',avatar_frame:'orbit',inventory,achievements:status,
 stats:{earned:98200,spent:27700,games:1840,transactions:164,days:[2200,1400,3400,1900,4400,2600,3800].map((v,n)=>{const d=new Date(now-(6-n)*86400000);return {label:`${d.getUTCDate()}.${String(d.getUTCMonth()+1).padStart(2,'0')}`,income:v,expense:[700,1800,1200,900,2400,1500,1000][n]};})}};
const rows=Array.from({length:8},(_,n)=>({user_id:String(n).padStart(20,'1'),xp:totalXpForLevel(52-n*4)+n*140,balance:150000-n*15023,bank:200000-n*13000,messages:8000-n*557,voice_seconds:(350-n*32)*3600}));
const users=['Renzuu','B3sttiee','NightShade','Darkqua','ShadowMonkey','Shinra','Nova','Adept'].map(name=>({name,username:name.toLowerCase()}));
const renders=[
 ['01-profil.png',()=>profileCard(demo,row,2,'Strażnik')],['02-ranga.png',()=>rankCard(demo,row,2)],
 ['03-portfel.png',()=>economyCard(demo,row,4,inventory)],['04-top.png',()=>topCard(rows,users)],['05-witaj.png',()=>welcomeCard(demo,1243)],
 ['06-top-monety.png',()=>topCard(rows,users,'wealth')],['07-top-vc.png',()=>topCard(rows,users,'voice_seconds')],['08-top-wiadomosci.png',()=>topCard(rows,users,'messages')],
 ['09-sklep.png',()=>shopCard(demo,row,inventory,'xp_boost_power','all',1)],['10-plecak.png',()=>inventoryCard(demo,row,inventory)],
 ['11-bank.png',()=>bankCard(demo,row)],['12-osiagniecia.png',()=>achievementsCard(demo,row,status)],
 ['13-profil-obsydian.png',()=>profileCard(demo,{...row,card_theme:'obsidian',avatar_frame:'crystal'},2,'Strażnik')],
 ['14-sklep-motywy.png',()=>shopCard(demo,row,inventory,'theme_eclipse','themes',1)],
];
for(const [name,render] of renders){fs.writeFileSync(path.join(folder,name),await render());console.log(`Podgląd: previews/${name}`);}
fs.writeFileSync(path.join(folder,'README.md'),'# Podglądy Wymiaru ZERQONA\n\nDane w przykładach są demonstracyjne. Bot generuje karty z aktualnej bazy i awatarów Discord. Wykres w przykładowym portfelu zawiera dane pokazowe.\n');
