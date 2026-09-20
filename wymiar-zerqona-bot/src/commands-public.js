import crypto from 'node:crypto';
import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { config } from './config.js';
import { BRAND, duration, embed, fmt, notice, respond, safe, stamp } from './ui.js';
import { items } from './shop.js';
import { levelForXp, multiplierFor, totalXpForLevel } from './level.js';
import { showRoomPanel } from './voice.js';
import { activate, purchase, resolveTarget, showCard, showHelp, showShop, showTop, showInventory, showBank, showAchievements } from './public-panels.js';

const phrases=['Zdecydowanie tak.','Jeszcze nie teraz.','Nie licz na to.','Wygląda obiecująco.','Zapytaj ponownie później.','Wymiar mówi: tak!','To ryzykowny pomysł.','Bez wątpienia.'];
const jobs=['Uporządkowano archiwum Wymiaru.','Dostarczono zapasy do portalu.','Zakończono patrol na granicy Wymiaru.','Naprawiono generator energii.','Odnaleziono zagubiony kryształ.'];
const labels={weekly:'Nagroda tygodniowa',achievement:'Osiągnięcie',bank_deposit:'Wpłata do banku',bank_withdraw:'Wypłata z banku',daily:'Nagroda daily',work:'Praca',level:'Awans poziomu',transfer_in:'Otrzymany przelew',transfer_out:'Wysłany przelew',purchase:'Zakup w sklepie',game:'Wynik gry',admin:'Korekta administracji'};
const publicNames=new Set(['pomoc','ping','profil','ranga','top','portfel','daily','praca','przelew','sklep','kup','plecak','uzyj','moneta','sloty','kostka','wrozba','kpn','ankieta','pokoj','userinfo','serverinfo','nagrody','poziomy','historia','tytul','avatar','botinfo','weekly','bank','osiagniecia','personalizacja','ekonomia']);
const ephem=i=>Boolean(i.options.getBoolean('prywatnie'));

export async function handlePublic(i,store){
  const guild=i.guildId,name=i.commandName;
  if(!publicNames.has(name))return false;
  if(name==='pomoc'){
    await showHelp(i,i.options.getString('kategoria')||'start',i.options.getString('komenda')?.replace(/^\//,''));
  }else if(name==='ping'){
    const ping=i.client.ws.ping;
    await respond(i,{embeds:[embed('Połączenie z Discordem').addFields(
      {name:'WebSocket',value:ping<0?'Trwa pomiar…':`${fmt(ping)} ms`,inline:true},
      {name:'Czas działania',value:duration(process.uptime()),inline:true})]},true);
  }else if(name==='pokoj'){
    await showRoomPanel(i,store);
  }else if(['profil','ranga','portfel'].includes(name)){
    await showCard(i,store,i.options.getUser('osoba')?.id||i.user.id,name);
  }else if(name==='top'){
    await showTop(i,store,i.options.getString('typ')||'xp',i.options.getInteger('strona')||1);
  }else if(name==='daily'||name==='praca'||name==='weekly'){
    const daily=name==='daily',weekly=name==='weekly',cfg=config.economy,reward=daily?cfg.dailyReward:weekly?cfg.weeklyReward:crypto.randomInt(cfg.workMin,cfg.workMax+1);
    await i.deferReply({flags:MessageFlags.Ephemeral});
    const result=store.claim(guild,i.user.id,daily?'daily':weekly?'weekly':'work',daily?cfg.dailyCooldownMs:weekly?cfg.weeklyCooldownMs:cfg.workCooldownMs,reward);
    if(!result.ok)await notice(i,'Nagroda jeszcze się odnawia',`Kolejny odbiór: **${stamp(result.availableAt)}**.\nDokładny termin: ${stamp(result.availableAt,'f')}.\nWszystkie terminy znajdziesz w \`/nagrody\`.`,true);
    else await respond(i,{embeds:[embed(daily?'Odebrano nagrodę daily':weekly?'Odebrano nagrodę tygodniową':'Praca zakończona',daily?`**Seria: ${result.streak} odbiorów.** Kolejny odbiór do 48 h utrzyma serię.`:weekly?'Wracaj co 7 dni po kolejną nagrodę Wymiaru.':jobs[crypto.randomInt(jobs.length)])
      .addFields({name:'Otrzymujesz',value:`+${fmt(result.reward)} ◈`,inline:true},{name:'Portfel',value:`${fmt(result.balance)} ◈`,inline:true},{name:'Kolejny odbiór',value:stamp(result.availableAt),inline:true})]});
  }else if(name==='nagrody'){
    const row=store.user(guild,i.user.id),cfg=config.economy,now=Date.now();
    const when=(last,ms)=>!last||last+ms<=now?'**Możesz odebrać teraz**':stamp(last+ms);
    const streak=row.last_daily_at&&now-row.last_daily_at<=cfg.dailyGraceMs?row.daily_streak:0;
    await respond(i,{embeds:[embed('Twoje nagrody i bonusy')
      .addFields({name:'Nagroda daily • /daily',value:`${when(row.last_daily_at,cfg.dailyCooldownMs)}\nNastępna: **${fmt(cfg.dailyReward+Math.min(streak,cfg.dailyStreakCap-1)*cfg.dailyStreakStep)} ◈** • seria: ${streak}`,inline:true},
        {name:'Praca • /praca',value:`${when(row.last_work_at,cfg.workCooldownMs)}\nNagroda: **${cfg.workMin}–${cfg.workMax} ◈**`,inline:true},
        {name:'Nagroda tygodniowa • /weekly',value:`${when(row.last_weekly_at,cfg.weeklyCooldownMs)}\nNagroda: **${fmt(cfg.weeklyReward)} ◈**`,inline:true},
        {name:'Kontrakt pracy',value:row.work_boost_until>now?`**${row.work_multiplier}×** do ${stamp(row.work_boost_until,'f')}`:'Nieaktywny • dostępny w sklepie'},
        {name:'Mnożnik XP',value:`**${multiplierFor(i.member,row,config)}× XP**\nIskra: ${row.booster_until>now?`do ${stamp(row.booster_until,'f')}`:'nieaktywna'}`},
        {name:'Zasada serii',value:'Odbieraj daily co najmniej co 24 h, najpóźniej do 48 h od poprzedniego odbioru. Maksymalny bonus: 650 monet od 7. odbioru.'})]},true);
  }else if(name==='poziomy'){
    await respond(i,{embeds:[embed('Ścieżka poziomów','Za rozmowy zdobywasz XP i odblokowujesz kolejne role.')
      .addFields({name:'Progi ról',value:config.levelRoles.map(r=>`**LV ${r.level}** • <@&${r.id}> • ${fmt(totalXpForLevel(r.level))} XP`).join('\n')},
        {name:'Wiadomości',value:'12–18 XP co 45 s. Minimum 3 znaki. Powtórzona ostatnia treść nie daje XP przez 5 minut.',inline:true},
        {name:'Rozmowy głosowe',value:'8 XP/min przy minimum 2 osobach. Boty, ogłuszenie, lobby i AFK nie dają XP.',inline:true},
        {name:'Premie',value:'Rola Booster: **2×**. Iskra: **1,5×**, Przebudzenie: **2×**. Z Boosterem łącznie **3×** lub **4×**. Pierwszy naturalny awans: **75 × nowy poziom** monet. Korekty administracji nie wypłacają nagród.'})]},true);
  }else if(name==='przelew'){
    const user=i.options.getUser('osoba',true),amount=i.options.getInteger('ilosc',true);
    await i.deferReply({flags:MessageFlags.Ephemeral});
    if(user.bot||user.id===i.user.id||!await resolveTarget(i,user.id)){
      await notice(i,'Nieprawidłowy odbiorca','Wybierz inną osobę należącą do serwera, która nie jest botem.',true,true);
    }else{
      const ok=store.transfer(guild,i.user.id,user.id,amount);
      await notice(i,ok?'Przelew wykonany':'Za mało monet',ok?`Odbiorca: <@${user.id}>\nPrzekazano: **${fmt(amount)} ◈**\nTwoje saldo: **${fmt(store.user(guild,i.user.id).balance)} ◈**.\nProwizja: **0 ◈**.`:`Masz **${fmt(store.user(guild,i.user.id).balance)} ◈**, a potrzebujesz **${fmt(amount)} ◈**.`,true,!ok);
    }
  }else if(name==='historia'){
    const rows=store.history(guild,i.user.id,i.options.getInteger('ile')||10);
    await respond(i,{embeds:[embed('Historia portfela',rows.length?'Ostatnie operacje zapisane od wersji 2.0. Starsze transakcje nie są odtwarzane.':'Brak operacji zapisanych od wersji 2.0. Zacznij od `/daily`.')
      .addFields(...rows.map(r=>({name:`${r.amount>=0?'+':''}${fmt(r.amount)} ◈ • ${labels[r.kind]||'Operacja'}`,value:`${stamp(r.created_at,'f')} • saldo: **${fmt(r.balance_after)} ◈**${r.details?`\n${r.kind.startsWith('transfer_')?`Osoba: <@${r.details}>`:safe(r.details)}`:''}`})))]},true);
  }else if(name==='sklep'){
    await showShop(i,store,i.options.getString('kategoria')||'all');
  }else if(name==='kup'||name==='uzyj'){
    await i.deferReply({flags:MessageFlags.Ephemeral});
    const result=(name==='kup'?purchase:activate)(store,guild,i.user.id,i.options.getString('przedmiot',true));
    await notice(i,result.ok?(name==='kup'?'Przedmiot kupiony':'Przedmiot aktywny'):'Nie można wykonać operacji',result.message,true,!result.ok);
  }else if(name==='plecak'){
    await showInventory(i,store);
  }else if(name==='tytul'){
    store.clearTitle(guild,i.user.id);await notice(i,'Zdjęto tytuł','Tytuł pozostaje w kolekcji. Załóż dowolny posiadany tytuł przez `/uzyj`.',true);
  }else if(name==='moneta'){
    const choice=i.options.getString('strona',true),stake=i.options.getInteger('stawka')||0;
    await i.deferReply();
    const result=crypto.randomInt(2)?'orzel':'reszka',won=choice===result;
    const balance=stake?store.wager(guild,i.user.id,stake,won?stake*2:0):null;
    if(balance===false)await notice(i,'Za mało monet',`Potrzebujesz **${fmt(stake)} ◈**. Sprawdź \`/portfel\`.`,true,true);
    else{
      const card=embed(won?'Rzut monetą • trafienie':'Rzut monetą • pudło',`Wypadł **${result==='orzel'?'orzeł':'reszka'}**. Twój wybór: **${choice==='orzel'?'orzeł':'reszka'}**.`);
      if(stake)card.addFields({name:'Stawka / wypłata',value:`${fmt(stake)} / ${fmt(won?stake*2:0)} ◈`,inline:true},{name:'Zysk / strata',value:`${won?'+':'−'}${fmt(stake)} ◈`,inline:true},{name:'Saldo',value:`${fmt(balance)} ◈`,inline:true});
      else card.addFields({name:'Runda bez stawki',value:'Twój portfel nie zmienił się.'});
      await respond(i,{embeds:[card]});
    }
  }else if(name==='sloty'){
    await i.deferReply();
    const stake=i.options.getInteger('stawka',true),symbols=['💎','⭐','🍒','⚡','🍀','7️⃣'];
    const rolls=Array.from({length:3},()=>symbols[crypto.randomInt(symbols.length)]),unique=new Set(rolls).size;
    const multiplier=unique===1?(rolls[0]==='💎'?8:5):unique===2?1.5:0,payout=Math.floor(stake*multiplier);
    const balance=store.wager(guild,i.user.id,stake,payout);
    if(balance===false)await notice(i,'Za mało monet',`Stawka wynosi **${fmt(stake)} ◈**. Sprawdź \`/portfel\`.`,true,true);
    else await respond(i,{embeds:[embed(unique===1?'Sloty • trzy trafienia!':unique===2?'Sloty • para':'Sloty • kolejna szansa',`## ${rolls.join('  │  ')}\n${multiplier?`Mnożnik wypłaty: **${multiplier}×**`:'Brak wygrywającego układu.'}`)
      .addFields({name:'Stawka',value:`${fmt(stake)} ◈`,inline:true},{name:'Cała wypłata',value:`${fmt(payout)} ◈`,inline:true},{name:'Zysk / strata',value:`${payout-stake>=0?'+':''}${fmt(payout-stake)} ◈`,inline:true},{name:'Portfel po rundzie',value:`${fmt(balance)} ◈`})]});
  }else if(name==='kostka'){
    const sides=i.options.getInteger('sciany')||6;await notice(i,`Rzut kością • k${sides}`,`Wynik: **${crypto.randomInt(1,sides+1)}**\nZakres: 1–${sides}.`);
  }else if(name==='wrozba'){
    await notice(i,'Wyrocznia Wymiaru',`**Pytanie:** ${safe(i.options.getString('pytanie',true))}\n\n${phrases[crypto.randomInt(phrases.length)]}`);
  }else if(name==='kpn'){
    const picks=['kamien','papier','nozyce'],names={kamien:'Kamień',papier:'Papier',nozyce:'Nożyce'};
    const you=i.options.getString('wybor',true),bot=picks[crypto.randomInt(3)],a=picks.indexOf(you),b=picks.indexOf(bot);
    await notice(i,a===b?'Kamień, papier, nożyce • remis':(a-b+3)%3===1?'Wygrywasz z botem!':'Tym razem wygrywa bot',`Twój ruch: **${names[you]}**\nRuch bota: **${names[bot]}**\nRunda bez stawki.`);
  }else if(name==='ankieta'){
    const opts=[1,2,3,4].map(n=>i.options.getString(`opcja${n}`)?.trim()).filter(Boolean),question=i.options.getString('pytanie',true).trim();
    if(!question||opts.length<2||new Set(opts.map(s=>s.toLocaleLowerCase('pl'))).size!==opts.length){
      await notice(i,'Popraw treść ankiety','Podaj pytanie oraz co najmniej 2 różne, niepuste odpowiedzi.',true,true);return true;
    }
    if(!i.appPermissions?.has([PermissionFlagsBits.AddReactions,PermissionFlagsBits.ReadMessageHistory])){
      await notice(i,'Brak uprawnień do głosowania','Bot potrzebuje **Dodawania reakcji** oraz **Czytania historii wiadomości** na tym kanale.',true,true);return true;
    }
    const emojis=['1️⃣','2️⃣','3️⃣','4️⃣'];
    await respond(i,{embeds:[embed(`Ankieta • ${question}`,opts.map((opt,n)=>`${emojis[n]} **${safe(opt)}**`).join('\n\n')).addFields({name:'Głosowanie',value:'Kliknij reakcję pod ankietą. Można wybrać kilka odpowiedzi; brak automatycznego zakończenia.'})]});
    const msg=await i.fetchReply();let failed=false;
    for(const em of emojis.slice(0,opts.length))try{await msg.react(em);}catch{failed=true;}
    if(failed)await notice(i,'Nie dodano wszystkich reakcji','Ankieta została wysłana, ale część reakcji jest niedostępna. Sprawdź uprawnienia bota.',true,true);
  }else if(name==='userinfo'||name==='avatar'){
    await i.deferReply(ephem(i)?{flags:MessageFlags.Ephemeral}:{});
    const target=await resolveTarget(i);
    if(!target){await notice(i,'Nie znaleziono osoby','Wybierz użytkownika należącego do serwera.',true,true);return true;}
    const {user,member}=target,url=member.displayAvatarURL({extension:'png',size:1024});
    if(name==='avatar')await respond(i,{embeds:[embed(`Awatar • ${member.displayName}`,`[Otwórz pełny obraz](${url})`).setImage(url)]});
    else{
      const row=store.user(guild,user.id);
      await respond(i,{embeds:[embed(`Profil Discord • ${member.displayName}`).setThumbnail(url).addFields(
        {name:'Osoba / ID',value:`<@${user.id}>\n\`${user.id}\``,inline:true},{name:'Konto utworzone',value:stamp(user.createdTimestamp,'f'),inline:true},
        {name:'Dołączenie',value:member.joinedTimestamp?stamp(member.joinedTimestamp,'f'):'Brak danych',inline:true},
        {name:'Aktywność',value:`Poziom **${levelForXp(row.xp)}** • **${fmt(row.xp)} XP** • VC **${duration(row.voice_seconds)}**`},
        {name:'Role (do 12 najwyższych)',value:member.roles.cache.filter(r=>r.id!==guild).sort((a,b)=>b.position-a.position).map(r=>r.toString()).slice(0,12).join(' ')||'Brak dodatkowych ról'})]});
    }
  }else if(name==='serverinfo'){
    const g=i.guild,card=embed('Informacje o serwerze',safe(g.name)).addFields(
      {name:'Osoby (wraz z botami)',value:fmt(g.memberCount),inline:true},{name:'Kanały w pamięci',value:fmt(g.channels.cache.size),inline:true},
      {name:'Boosty',value:`${fmt(g.premiumSubscriptionCount||0)} • poziom ${g.premiumTier}`,inline:true},{name:'Utworzony',value:stamp(g.createdTimestamp,'f')},{name:'ID serwera',value:`\`${g.id}\``});
    if(g.iconURL())card.setThumbnail(g.iconURL());await respond(i,{embeds:[card]});
  }else if(name==='bank'){
    const action=i.options.getSubcommand();
    if(action==='saldo')await showBank(i,store);
    else{
      await i.deferReply({flags:MessageFlags.Ephemeral});
      const value=i.options.getInteger('ilosc',true),result=store.bankMove(guild,i.user.id,action==='wplac'?'deposit':'withdraw',value);
      if(!result.ok)await notice(i,'Za mało monet',`Dostępne ${action==='wplac'?'w portfelu':'w banku'}: **${fmt(result.available)} ◈**.`,true,true);
      else{
        await showBank(i,store);
        await i.followUp({embeds:[embed(action==='wplac'?'Wpłata do banku':'Wypłata z banku',`Przeniesiono **${fmt(value)} ◈**. Prowizja: **0 ◈**.`)],flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
      }
    }
  }else if(name==='osiagniecia'){
    await showAchievements(i,store);
  }else if(name==='personalizacja'){
    await i.deferReply({flags:MessageFlags.Ephemeral});
    if(i.options.getSubcommand()==='reset')store.resetAppearance(guild,i.user.id);
    await showCard(i,store,i.user.id,'profil');
  }else if(name==='ekonomia'){
    await i.deferReply({flags:MessageFlags.Ephemeral});await showCard(i,store,i.user.id,'portfel');
  }else if(name==='botinfo'){
    await respond(i,{embeds:[embed('Bot Wymiaru ZERQONA','Profile • poziomy • ekonomia • moderacja • logi • pokoje głosowe')
      .addFields({name:'Wersja',value:BRAND.version,inline:true},{name:'Czas pracy',value:duration(process.uptime()),inline:true},{name:'Zapisane profile',value:fmt(store.userCount(guild)),inline:true},
        {name:'Na początek',value:'`/pomoc` → lista komend\n`/profil` → Twoja karta\n`/daily` → pierwsze monety\n`/poziomy` → zasady rozwoju'})]},true);
  }
  return true;
}
