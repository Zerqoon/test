import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, MessageFlags, StringSelectMenuBuilder } from 'discord.js';
import { categories, commandMeta } from './command-meta.js';
import { config } from './config.js';
import { items, permanent, itemRules, shopCategories, rarityNames } from './shop.js';
import { profileCard, rankCard, economyCard, topCard, shopCard, inventoryCard, bankCard, achievementsCard, userForCard } from './cards.js';
import { levelForXp, multiplierFor } from './level.js';
import { staffTier, tierName } from './permissions.js';
import { embed, fmt, notice, respond, stamp, duration, denyPermission } from './ui.js';

const button = (id,label,active=false) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(active?ButtonStyle.Primary:ButtonStyle.Secondary).setDisabled(active);
const privateOption = i => Boolean(i.options?.getBoolean?.('prywatnie'));
async function defer(i, privateReply=false) { if(!i.deferred&&!i.replied) await i.deferReply(privateReply?{flags:MessageFlags.Ephemeral}:{}); }

export function helpPayload(i, category='start', command=null) {
  const tier=staffTier(i);
  const accessible=Object.entries(commandMeta);
  const available=Object.entries(categories).filter(([key])=>accessible.some(([,m])=>m.category===key));
  if(!available.some(([key])=>key===category))category='start';
  let card;
  const meta=commandMeta[command];
  if(command && meta){
    category=meta.category;
    card=embed(`/${command}`,meta.summary).addFields(
      {name:'Jak używać',value:`\`${meta.usage}\``},
      {name:'Zasady i ograniczenia',value:meta.details},
      {name:'Dostęp',value:tierName(meta.tier),inline:true},
      {name:'Kategoria',value:categories[category],inline:true},
    );
  }else{
    card=embed(`Centrum komend • ${categories[category]}`,'Wybierz kategorię poniżej. Dokładne zasady: `/pomoc komenda:nazwa`.\n`[parametr]` jest opcjonalny; pozostałe parametry są wymagane.');
    card.addFields(...accessible.filter(([,m])=>m.category===category).map(([name,m])=>({name:`/${name}`,value:`${m.summary}\n\`${m.usage}\`${m.tier?`\nDostęp: **${tierName(m.tier)}**${m.tier>tier?' • 🔒':''}`:''}`})));
  }
  const menu=new StringSelectMenuBuilder().setCustomId(`wz:help:${i.user.id}`).setPlaceholder('Wybierz kategorię komend')
    .addOptions(available.map(([value,label])=>({label,value,default:value===category})));
  return {embeds:[card],components:[new ActionRowBuilder().addComponents(menu)]};
}
export async function showHelp(i,category,command){
  if(command && !Object.hasOwn(commandMeta,command)) return notice(i,'Nie znaleziono dostępnej komendy','Wybierz nazwę z podpowiedzi lub otwórz `/pomoc`.',true,true);
  return respond(i,helpPayload(i,category,command),true);
}
export async function resolveTarget(i,id=i.options?.getUser('osoba')?.id||i.user.id){
  const member=i.guild.members.cache.get(id)||await i.guild.members.fetch(id).catch(()=>null);
  if(!member||member.user.bot)return null;
  return {user:member.user,member,display:userForCard(member)};
}
export async function showCard(i,store,userId,view='profil'){
  await defer(i,privateOption(i));
  const target=await resolveTarget(i,userId);
  if(!target)return respond(i,{content:'Wybierz osobę należącą do serwera, która nie jest botem.',embeds:[],components:[],attachments:[]});
  const row=store.user(i.guildId,userId),field=view==='portfel'?'balance':'xp';
  row.multiplier=multiplierFor(target.member,row,config);
  row.inventory=store.inventory(i.guildId,userId);row.achievements=store.achievementStatus(i.guildId,userId);if(view==='portfel')row.stats=store.stats(i.guildId,userId);
  const rank=store.rank(i.guildId,userId,field);
  const role=[...config.levelRoles].reverse().find(r=>levelForXp(row.xp)>=r.level)?.name||'Początkujący';
  const png=view==='portfel'?await economyCard(target.display,row,rank,store.inventory(i.guildId,userId)):
    view==='ranga'?await rankCard(target.display,row,rank):await profileCard(target.display,row,rank,role);
  const components=[new ActionRowBuilder().addComponents(...[['profil','Profil'],['ranga','Ranga'],['portfel','Portfel']].map(([id,label])=>button(`wz:card:${i.user.id}:${userId}:${id}`,label,id===view)))];
  return respond(i,{content:null,embeds:[],attachments:[],files:[new AttachmentBuilder(png,{name:`zerqona-${view}.png`})],components});
}
const rankingKinds=new Set(['xp','balance','wealth','bank','messages','voice_seconds']);
export async function showTop(i,store,kind='xp',page=1){
  await defer(i,privateOption(i));
  if(!rankingKinds.has(kind))kind='xp';
  const total=store.userCount(i.guildId),pages=Math.max(1,Math.ceil(total/10));
  page=Math.max(1,Math.min(pages,Number.isSafeInteger(page)?page:1));
  const offset=(page-1)*10,rows=store.top(i.guildId,kind,10,offset);
  if(!rows.length)return respond(i,{embeds:[embed('Ranking jest jeszcze pusty','Porozmawiaj na serwerze lub odbierz `/daily`, aby rozpocząć.')],attachments:[],components:[]});
  const users=await Promise.all(rows.map(async row=>{
    const member=i.guild.members.cache.get(row.user_id)||await i.guild.members.fetch(row.user_id).catch(()=>null);
    if(member)return userForCard(member);
    const user=i.client.users.cache.get(row.user_id)||await i.client.users.fetch(row.user_id).catch(()=>null);
    return user?userForCard(user):{name:`Użytkownik ${row.user_id.slice(-5)}`};
  }));
  const png=await topCard(rows,users,kind,offset,total);
  const prev=button(`wz:top:${i.user.id}:${kind}:${page-1}`,'Poprzednia').setDisabled(page===1);
  const next=button(`wz:top:${i.user.id}:${kind}:${page+1}`,'Następna').setDisabled(page===pages);
  const own=store.find.get(i.guildId,i.user.id);
  return respond(i,{content:`Strona **${page}/${pages}**${own?` • Twoje miejsce: **#${fmt(store.rank(i.guildId,i.user.id,kind))}**`:''}`,embeds:[],attachments:[],
    files:[new AttachmentBuilder(png,{name:`zerqona-ranking-${kind}.png`})],components:[new ActionRowBuilder().addComponents(prev,next)]});
}
export async function shopPayload(i,store,id='xp_boost',category='all',page=1){
  if(!Object.hasOwn(shopCategories,category))category='all';
  const catalog=Object.entries(items).filter(([,it])=>category==='all'||it.category===category),pages=Math.ceil(catalog.length/6);
  page=Math.max(1,Math.min(pages,Number.isSafeInteger(page)?page:1));
  const visible=catalog.slice((page-1)*6,page*6);
  if(!visible.some(([key])=>key===id))id=visible[0][0];
  const item=items[id],row=store.user(i.guildId,i.user.id),inventory=store.inventory(i.guildId,i.user.id),owns=store.owns(i.guildId,i.user.id,id);
  const buffer=await shopCard(userForCard(i.member),row,inventory,id,category,page);
  const active=item.type==='title'?row.title===item.title:item.type==='theme'?row.card_theme===item.theme:item.type==='frame'?row.avatar_frame===item.frame:false;
  const card=embed(`Sklep • ${item.name}`,`${item.description}\n\n**Zasady:** ${itemRules(item)}`).setImage('attachment://zerqona-sklep.png')
    .addFields({name:'Cena / saldo',value:`${fmt(item.price)} / ${fmt(row.balance)} ZC`,inline:true},{name:'Jakość / czas',value:`${rarityNames[item.rarity]} • ${item.durationMs?duration(item.durationMs/1000):'na stałe'}`,inline:true});
  const categoryMenu=new StringSelectMenuBuilder().setCustomId(`wz:shopcat:${i.user.id}`).setPlaceholder('Kategoria sklepu')
    .addOptions(Object.entries(shopCategories).map(([value,label])=>({value,label,default:value===category})));
  const select=new StringSelectMenuBuilder().setCustomId(`wz:shop:${i.user.id}:${category}:${page}`).setPlaceholder('Wybierz przedmiot z tej strony')
    .addOptions(visible.map(([value,it])=>({label:it.name,description:`${fmt(it.price)} monet • ${rarityNames[it.rarity]}`,value,default:value===id})));
  const buy=button(`wz:buy:${i.user.id}:${id}:${category}:${page}`,permanent(item)&&owns?'W kolekcji':`Kup • ${fmt(item.price)} monet`).setStyle(ButtonStyle.Primary).setDisabled(row.balance<item.price||(permanent(item)&&owns));
  const use=button(`wz:use:${i.user.id}:${id}:${category}:${page}`,permanent(item)?'Załóż':'Aktywuj').setDisabled(!owns||active);
  const nav=new ActionRowBuilder().addComponents(button(`wz:shoppage:${i.user.id}:${category}:${page-1}`,'Poprzednia').setDisabled(page<=1),button(`wz:shoppage:${i.user.id}:${category}:${page+1}`,'Następna').setDisabled(page>=pages));
  return {content:null,embeds:[card],attachments:[],files:[new AttachmentBuilder(buffer,{name:'zerqona-sklep.png'})],components:[new ActionRowBuilder().addComponents(categoryMenu),new ActionRowBuilder().addComponents(select),new ActionRowBuilder().addComponents(buy,use),nav]};
}
export async function showShop(i,store,category='all'){await defer(i,true);return respond(i,await shopPayload(i,store,'xp_boost',category));}
export function purchase(store,guild,user,id){
  const item=Object.hasOwn(items,id)&&items[id];
  if(!item)return {ok:false,message:'Ten przedmiot nie istnieje. Otwórz `/sklep`.'};
  if(permanent(item)&&store.owns(guild,user,id))return {ok:false,message:'Ten przedmiot jest już w Twojej kolekcji. Załóż go przez `/uzyj`.'};
  if(!store.buy(guild,user,id))return {ok:false,message:`Potrzebujesz **${fmt(item.price)} ZC**. Masz **${fmt(store.user(guild,user).balance)} ZC**.`};
  return {ok:true,message:`**${item.name}** trafia do plecaka.\nKoszt: **${fmt(item.price)} ZC** • saldo: **${fmt(store.user(guild,user).balance)} ZC**.\nAktywuj przez \`/uzyj przedmiot:${id}\`.`};
}
export function activate(store,guild,user,id){
  const item=Object.hasOwn(items,id)&&items[id],row=store.user(guild,user);
  if(!item)return {ok:false,message:'Ten przedmiot nie istnieje.'};
  if(item.type==='consumable'){
    const until=item.effect==='xp'?'booster_until':'work_boost_until',mult=item.effect==='xp'?'xp_multiplier':'work_multiplier';
    if(row[until]>Date.now()&&row[mult]!==item.multiplier)return {ok:false,message:`Masz aktywny mnożnik **${row[mult]}×** tego efektu do ${stamp(row[until],'f')}. Inny mnożnik możesz włączyć po jego zakończeniu. Przedmiot nie został zużyty.`};
  }
  if(!store.use(guild,user,id))return {ok:false,message:'Nie masz tego przedmiotu. Otwórz `/plecak` lub `/sklep`.'};
  const updated=store.user(guild,user);
  const message=item.type==='consumable'?`**${item.name}**: ${item.multiplier}× ${item.effect==='xp'?'XP':'wynagrodzenia z /praca'}, do ${stamp(item.effect==='xp'?updated.booster_until:updated.work_boost_until,'f')}.\n${itemRules(item)}`:
    `Założono **${item.name}**. Otwórz \`/profil\`, aby zobaczyć efekt. Przedmiot pozostaje w kolekcji.`;
  return {ok:true,message};
}
export async function showInventory(i,store){
  await defer(i,true);const row=store.user(i.guildId,i.user.id),inventory=store.inventory(i.guildId,i.user.id);
  const image=await inventoryCard(userForCard(i.member),row,inventory),select=new StringSelectMenuBuilder().setCustomId(`wz:inventory:${i.user.id}`).setPlaceholder('Załóż lub aktywuj przedmiot')
    .addOptions(inventory.filter(r=>items[r.item_id]).map(r=>({label:items[r.item_id].name,value:r.item_id,description:permanent(items[r.item_id])?'Kosmetyk w kolekcji':`${r.quantity} sztuk`})).slice(0,25));
  return respond(i,{content:null,attachments:[],embeds:[embed('Twój plecak','Wybierz posiadany przedmiot w menu, aby go założyć lub aktywować.').setImage('attachment://zerqona-plecak.png')],files:[new AttachmentBuilder(image,{name:'zerqona-plecak.png'})],components:inventory.some(r=>items[r.item_id])?[new ActionRowBuilder().addComponents(select)]:[]});
}
export async function showBank(i,store){await defer(i,true);const row=store.user(i.guildId,i.user.id);return respond(i,{embeds:[embed('Bank Wymiaru','Wpłata: `/bank wplac ilosc:500`\nWypłata: `/bank wyplac ilosc:500`\nBank nie nalicza odsetek.').setImage('attachment://zerqona-bank.png')],files:[new AttachmentBuilder(await bankCard(userForCard(i.member),row),{name:'zerqona-bank.png'})],attachments:[],components:[]});}
export async function showAchievements(i,store){
  await defer(i,true);const row=store.user(i.guildId,i.user.id),status=store.achievementStatus(i.guildId,i.user.id);
  return respond(i,{content:null,embeds:[embed('Osiągnięcia Wymiaru','Każda nagroda jest jednorazowa. Ukończone osiągnięcia odbierzesz przyciskiem.').setImage('attachment://zerqona-osiagniecia.png')],attachments:[],files:[new AttachmentBuilder(await achievementsCard(userForCard(i.member),row,status),{name:'zerqona-osiagniecia.png'})],components:[new ActionRowBuilder().addComponents(button(`wz:achclaim:${i.user.id}`,'Odbierz dostępne nagrody').setStyle(ButtonStyle.Primary).setDisabled(!status.some(a=>a.ready)))]});
}
const commerceUntil=new Map();
export async function handlePublicComponent(i,store){
  if(!(i.isButton()||i.isStringSelectMenu())||!i.customId.startsWith('wz:'))return false;
  const [,action,owner,a,b,d]=i.customId.split(':');
  if(owner!==i.user.id){await denyPermission(i,'Autor tego panelu','Otwórz własny panel odpowiednią komendą.');return true;}
  if(action==='help'){await i.update({...helpPayload(i,i.values[0]),allowedMentions:{parse:[]}});return true;}
  if(action==='card'&&['profil','ranga','portfel'].includes(b)){await i.deferUpdate();await showCard(i,store,a,b);return true;}
  if(action==='top'){await i.deferUpdate();await showTop(i,store,a,Number(b));return true;}
  if(['shop','shopcat','shoppage'].includes(action)){
    await i.deferUpdate();const category=action==='shopcat'?i.values[0]:a,page=action==='shopcat'?1:Number(b),id=action==='shop'?i.values[0]:'xp_boost';
    await i.editReply({...await shopPayload(i,store,id,category,page),allowedMentions:{parse:[]}});return true;
  }
  if(['buy','use','inventory','achclaim'].includes(action)){
    const key=`${i.guildId}:${i.user.id}`,now=Date.now();
    if((commerceUntil.get(key)||0)>now){await notice(i,'Chwila przerwy','Poczekaj 2 sekundy przed kolejną operacją.',true);return true;}
    commerceUntil.set(key,now+2000);if(commerceUntil.size>5000)for(const [k,t] of commerceUntil)if(t<now)commerceUntil.delete(k);
    await i.deferUpdate();let result;
    if(action==='achclaim'){
      const claimed=store.claimAchievements(i.guildId,i.user.id);result={ok:claimed.count>0,message:claimed.count?`Odebrano **${claimed.count}** osiągnięć: **+${fmt(claimed.reward)} ZC**.`:'Nie masz nowych nagród do odebrania.'};await showAchievements(i,store);
    }else if(action==='inventory'){
      result=activate(store,i.guildId,i.user.id,i.values[0]);await showInventory(i,store);
    }else{
      result=(action==='buy'?purchase:activate)(store,i.guildId,i.user.id,a);
      const category=b||'all',catalog=Object.keys(items).filter(id=>category==='all'||items[id].category===category),page=d?Number(d):Math.floor(catalog.indexOf(a)/6)+1;
      await i.editReply({...await shopPayload(i,store,a,category,page),allowedMentions:{parse:[]}});
    }
    await i.followUp({embeds:[embed(result.ok?'Gotowe':'Nie można wykonać operacji',result.message,{error:!result.ok})],flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});return true;
  }
  await notice(i,'Ten przycisk jest nieaktualny','Otwórz panel ponownie komendą.',true,true);return true;
}
export async function handleAutocomplete(i,store){
  const needle=String(i.options.getFocused()||'').toLocaleLowerCase('pl');let options=[];
  if(i.commandName==='pomoc')options=Object.entries(commandMeta).filter(([name])=>name.includes(needle)).map(([name,m])=>({name:`/${name} — ${m.summary}`.slice(0,100),value:name}));
  if(i.commandName==='uzyj')options=store.inventory(i.guildId,i.user.id).filter(row=>items[row.item_id]&&`${row.item_id} ${items[row.item_id].name}`.toLocaleLowerCase('pl').includes(needle)).map(row=>({name:`${items[row.item_id].name} • ${permanent(items[row.item_id])?'kolekcja':`×${row.quantity}`}`,value:row.item_id}));
  await i.respond(options.slice(0,25));
}
