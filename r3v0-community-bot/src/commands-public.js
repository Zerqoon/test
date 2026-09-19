import crypto from 'node:crypto';
import { AttachmentBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { config } from './config.js';
import { profileCard, rankCard, economyCard, topCard, userForCard } from './cards.js';
import { items } from './shop.js';
import { levelForXp } from './level.js';
import { showRoomPanel } from './voice.js';

const fmt=n=>new Intl.NumberFormat('pl-PL').format(n);
const say=(i,content,privateReply=false)=>i.reply({content,flags:privateReply?MessageFlags.Ephemeral:undefined,allowedMentions:{parse:[]}});
const stamp=d=>`<t:${Math.floor(d/1000)}:F>`;
const phrases=['Zdecydowanie tak.','Jeszcze nie teraz.','Nie licz na to.','Wygląda obiecująco.','Zapytaj ponownie później.','Gwiazdy mówią: tak!','To ryzykowny pomysł.','Bez wątpienia.'];
async function target(i){
  const user=i.options.getUser('osoba')||i.user;
  const member=await i.guild.members.fetch(user.id).catch(()=>null);
  return {user,member,display:userForCard(member||user)};
}

export async function handlePublic(i,store){
  const guild=i.guildId,name=i.commandName;
  if(name==='pomoc'){
    const embed=new EmbedBuilder().setColor(0xA76CFF).setTitle('✦ R3V0 · CENTRUM KOMEND')
      .setDescription('Zdobywaj XP w rozmowach i VC, rozwijaj profil, baw się i twórz własny pokój głosowy.')
      .addFields(
        {name:'◆ PROFIL I POZIOMY',value:'`/profil` `/ranga` `/top` `/userinfo` `/serverinfo`'},
        {name:'◈ EKONOMIA',value:'`/portfel` `/daily` `/praca` `/przelew` `/sklep` `/kup` `/plecak` `/uzyj`'},
        {name:'✦ ZABAWA',value:'`/moneta` `/sloty` `/kostka` `/wrozba` `/kpn` `/ankieta`'},
        {name:'◉ TWÓJ GŁOSOWY',value:`Wejdź do <#${config.channels.voiceLobby}> → bot utworzy kanał. Użyj panelu na tym kanale lub \`/pokoj\`.`},
        {name:'⚙ EKIPA',value:'Helper: `/warn` `/unwarn` `/wyczysc` • Moderator: `/mute` `/unmute` `/timeout` `/untimeout` `/kick` `/ban` `/unban` `/slowmode` `/zamknij` `/otworz` • Szef: `/rola` `/xp` `/monety_admin`'},
      ).setFooter({text:'Booster: 2× XP z wiadomości i VC. Pokój znika po opróżnieniu.'});
    await i.reply({embeds:[embed],flags:MessageFlags.Ephemeral});return true;
  }
  if(name==='ping'){await say(i,`🏓 Opóźnienie WebSocket: **${i.client.ws.ping} ms**.`);return true;}
  if(name==='pokoj'){await showRoomPanel(i,store);return true;}
  if(['profil','ranga','portfel'].includes(name)){
    await i.deferReply();
    const {user,member,display}=await target(i);const row=store.user(guild,user.id);
    const field=name==='portfel'?'balance':'xp',rank=store.rank(guild,user.id,field);
    const role=[...config.levelRoles].reverse().find(r=>levelForXp(row.xp)>=r.level)?.name||'Początkujący';
    const image=name==='profil'?await profileCard(display,row,rank,role):name==='ranga'?await rankCard(display,row,rank):await economyCard(display,row,rank,store.inventory(guild,user.id));
    await i.editReply({files:[new AttachmentBuilder(image,{name:`${name}-${user.id}.png`})]});return true;
  }
  if(name==='top'){
    await i.deferReply();const kind=i.options.getString('typ')||'xp';
    const rows=store.top(guild,kind,10);
    if(!rows.length){await i.editReply('Ranking jest pusty. Napisz wiadomość albo użyj /daily.');return true;}
    const users=await Promise.all(rows.map(async row=>{
      const member=await i.guild.members.fetch(row.user_id).catch(()=>null);
      if(member)return userForCard(member);
      const user=await i.client.users.fetch(row.user_id).catch(()=>null);
      return user?userForCard(user):{name:`Gracz ${row.user_id.slice(-5)}`};
    }));
    const image=await topCard(rows,users,kind);
    await i.editReply({files:[new AttachmentBuilder(image,{name:`top-${kind}.png`})]});return true;
  }
  if(name==='daily'||name==='praca'){
    const isDaily=name==='daily',reward=isDaily?350:crypto.randomInt(100,241);
    const result=store.claim(guild,i.user.id,isDaily?'daily':'work',isDaily?24*3600000:45*60000,reward);
    if(!result.ok){await say(i,`⏳ Następna nagroda: <t:${Math.floor(result.availableAt/1000)}:R>.`,true);return true;}
    await say(i,`◈ Zdobywasz **${fmt(reward)} monet**! Stan konta: **${fmt(result.balance)} ◈**.`);return true;
  }
  if(name==='przelew'){
    const user=i.options.getUser('osoba',true),amount=i.options.getInteger('ilosc',true);
    if(user.bot||user.id===i.user.id){await say(i,'Wybierz inną osobę, która nie jest botem.',true);return true;}
    const ok=store.transfer(guild,i.user.id,user.id,amount);
    await say(i,ok?`◈ Przelano **${fmt(amount)}** monet osobie <@${user.id}>.`:'Masz za mało monet.',!ok);return true;
  }
  if(name==='sklep'){
    const embed=new EmbedBuilder().setColor(0xC5FF60).setTitle('◈ SKLEP · R3V0')
      .setDescription('Kup `/kup`, uruchom `/uzyj`, sprawdź `/plecak`.')
      .addFields(Object.entries(items).map(([id,item])=>({name:`${item.name} · ${fmt(item.price)} ◈`,value:`${item.description}\nID: \`${id}\``,inline:false})));
    await i.reply({embeds:[embed]});return true;
  }
  if(name==='kup'){
    const id=i.options.getString('przedmiot',true),ok=store.buy(guild,i.user.id,id);
    await say(i,ok?`🛍️ Kupiono **${items[id].name}** za ${fmt(items[id].price)} ◈. Użyj `/uzyj`.`:'Nie masz wystarczająco monet.',!ok);return true;
  }
  if(name==='plecak'){
    const inventory=store.inventory(guild,i.user.id);
    const desc=inventory.length?inventory.map(row=>`**${items[row.item_id]?.name||row.item_id}** ×${row.quantity}`).join('\n'):'Plecak jest pusty. Zajrzyj do `/sklep`.';
    await i.reply({embeds:[new EmbedBuilder().setColor(0xA76CFF).setTitle(`🎒 Plecak · ${i.user.username}`).setDescription(desc)],flags:MessageFlags.Ephemeral});return true;
  }
  if(name==='uzyj'){
    const id=i.options.getString('przedmiot',true),ok=store.use(guild,i.user.id,id);
    const when=store.user(guild,i.user.id).booster_until;
    await say(i,ok?(id==='xp_boost'?`✨ Włączono +50% XP. Efekt trwa do ${stamp(when)}. Booster roli 2× nadal działa.`:`👑 Ustawiono tytuł: **${items[id].title}**.`):'Nie masz tego przedmiotu w plecaku.',true);return true;
  }
  if(name==='moneta'){
    const choice=i.options.getString('strona',true),stake=i.options.getInteger('stawka')||0;
    const result=crypto.randomInt(2)?'orzel':'reszka',won=choice===result;
    let balance;
    if(stake){balance=store.wager(guild,i.user.id,stake,won?stake*2:0);if(balance===false){await say(i,'Nie masz tylu monet.',true);return true;}}
    await say(i,`🪙 Wypadł **${result==='orzel'?'orzeł':'reszka'}**. ${won?'Wygrywasz!':'Tym razem przegrywasz.'}${stake?` Bilans rundy: **${won?'+':''}${fmt(won?stake:-stake)} ◈**, saldo ${fmt(balance)} ◈.`:''}`);return true;
  }
  if(name==='sloty'){
    const stake=i.options.getInteger('stawka',true),symbols=['💎','⭐','🍒','⚡','🍀','7️⃣'];
    const rolls=Array.from({length:3},()=>symbols[crypto.randomInt(symbols.length)]);
    const triple=rolls[0]===rolls[1]&&rolls[1]===rolls[2];
    const pair=new Set(rolls).size===2;
    const payout=triple?stake*(rolls[0]==='💎'?8:5):pair?Math.floor(stake*1.5):0;
    const balance=store.wager(guild,i.user.id,stake,payout);
    if(balance===false){await say(i,'Nie masz tylu monet.',true);return true;}
    await say(i,`🎰 **${rolls.join('  │  ')}**\n${triple?'JACKPOT!':pair?'Para!':'Brak trafienia.'} Wpłata: ${fmt(stake)} ◈ • wygrana: **${fmt(payout)} ◈** • saldo: ${fmt(balance)} ◈.`);return true;
  }
  if(name==='kostka'){const sides=i.options.getInteger('sciany')||6;await say(i,`🎲 Rzut k${sides}: **${crypto.randomInt(1,sides+1)}**.`);return true;}
  if(name==='wrozba'){await say(i,`🎱 ${i.options.getString('pytanie',true)}\n**${phrases[crypto.randomInt(phrases.length)]}**`);return true;}
  if(name==='kpn'){
    const picks=['kamien','papier','nozyce'];const you=i.options.getString('wybor',true),bot=picks[crypto.randomInt(3)];
    const a=picks.indexOf(you),b=picks.indexOf(bot),result=a===b?'Remis!':(a-b+3)%3===1?'Wygrywasz!':'Wygrywa bot!';
    await say(i,`✊ Ty: **${you}** • bot: **${bot}** — ${result}`);return true;
  }
  if(name==='ankieta'){
    const q=i.options.getString('pytanie',true),opts=[1,2,3,4].map(n=>i.options.getString(`opcja${n}`)).filter(Boolean);
    const emojis=['1️⃣','2️⃣','3️⃣','4️⃣'];
    const embed=new EmbedBuilder().setColor(0xA76CFF).setTitle(`📊 ${q}`).setDescription(opts.map((opt,n)=>`${emojis[n]} ${opt}`).join('\n\n')).setFooter({text:`Ankieta utworzona przez ${i.user.username}`});
    await i.reply({embeds:[embed],allowedMentions:{parse:[]}});const msg=await i.fetchReply();
    for(const em of emojis.slice(0,opts.length))await msg.react(em).catch(()=>{});
    return true;
  }
  if(name==='userinfo'){
    const {user,member}=await target(i);
    const desc=[`**Osoba:** <@${user.id}>`, `**ID:** \`${user.id}\``, `**Konto:** ${stamp(user.createdTimestamp)}`,
      `**Na serwerze:** ${member?.joinedTimestamp?stamp(member.joinedTimestamp):'Nie jest na serwerze'}`,
      `**Poziom:** ${levelForXp(store.user(guild,user.id).xp)}`,`**Role:** ${member?.roles.cache.filter(r=>r.id!==guild).map(r=>r.toString()).slice(0,15).join(' ')||'brak'}`].join('\n');
    await i.reply({embeds:[new EmbedBuilder().setColor(0xA76CFF).setTitle(`✦ ${user.username}`).setThumbnail(user.displayAvatarURL()).setDescription(desc)]});return true;
  }
  if(name==='serverinfo'){
    const g=i.guild;const embed=new EmbedBuilder().setColor(0xA76CFF).setTitle(`✦ ${g.name}`)
      .addFields({name:'Osoby',value:fmt(g.memberCount),inline:true},{name:'Kanały',value:String(g.channels.cache.size),inline:true},
        {name:'Boosty',value:String(g.premiumSubscriptionCount||0),inline:true},{name:'Założony',value:stamp(g.createdTimestamp),inline:false});
    if(g.iconURL())embed.setThumbnail(g.iconURL());
    await i.reply({embeds:[embed]});return true;
  }
  return false;
}
