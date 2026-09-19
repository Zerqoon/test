import fs from 'node:fs';
import path from 'node:path';
import { profileCard, rankCard, economyCard, topCard, welcomeCard } from '../src/cards.js';
import { totalXpForLevel } from '../src/level.js';

const folder=path.resolve('previews');fs.mkdirSync(folder,{recursive:true});
const demo={name:'B3sttiee',username:'b3sttiee'};
const row={xp:totalXpForLevel(26)+1240,balance:18450,messages:2680,voice_seconds:3600*82,booster_until:0,title:'WŁADCA BURZY'};
const rows=Array.from({length:8},(_,n)=>({user_id:String(n).padStart(20,'1'),xp:totalXpForLevel(52-n*4)+n*140,balance:30000-n*3023}));
const users=['Renzuu','B3sttiee','NightShade','Darkqua','ShadowMonkey','Shinra','Nova','Adept'].map(name=>({name,username:name.toLowerCase()}));
for(const [name,buffer] of [
  ['01-profil.png',await profileCard(demo,row,2,'Wędrowiec')],
  ['02-ranga.png',await rankCard(demo,row,2)],
  ['03-portfel.png',await economyCard(demo,row,6,[{quantity:2},{quantity:1}])],
  ['04-top.png',await topCard(rows,users)],
  ['05-witaj.png',await welcomeCard(demo,1243)],
]){
  fs.writeFileSync(path.join(folder,name),buffer);console.log(`Podgląd: previews/${name}`);
}
