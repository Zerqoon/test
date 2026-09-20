const product=(name,price,type,category,rarity,description,extra={})=>Object.freeze({name,price,type,category,rarity,description,...extra});

export const shopCategories=Object.freeze({
  all:'Wszystko',
  boosts:'Boosty czasowe',
  titles:'Tytuły',
  themes:'Style kart',
  frames:'Ramki profilu',
});
export const rarityNames=Object.freeze({rare:'Rzadki',epic:'Epicki',legendary:'Legendarny'});

// Identyfikatory przedmiotów pozostają kompatybilne ze starszą bazą.
// Każdy przedmiot typu consumable jest wyłącznie czasowy — w sklepie nie ma stałych boostów.
export const items=Object.freeze({
  xp_boost:product('Podwójna kawa',1800,'consumable','boosts','rare','Przez 60 minut zdobywasz 50% więcej XP z wiadomości i aktywnego VC.',{effect:'xp',multiplier:1.5,durationMs:3_600_000,icon:'clock',tag:'+50% XP • 1 H'}),
  xp_boost_long:product('Nocny maraton',9000,'consumable','boosts','epic','Ten sam bonus 1,5× XP, ale działa przez pełne 6 godzin.',{effect:'xp',multiplier:1.5,durationMs:21_600_000,icon:'headset',tag:'1,5× XP • 6 H'}),
  xp_boost_power:product('Tryb turbo',4000,'consumable','boosts','legendary','Przez godzinę zdobywasz 2× XP. Z rolą Booster łączny mnożnik wynosi 4×.',{effect:'xp',multiplier:2,durationMs:3_600_000,icon:'bolt',tag:'2× XP • 1 H'}),
  work_boost:product('Nadgodziny',120,'consumable','boosts','rare','Przez 3 godziny każda ukończona /praca wypłaca o 50% więcej. Cooldown pracy się nie zmienia.',{effect:'work',multiplier:1.5,durationMs:10_800_000,icon:'briefcase',tag:'+50% PRACA • 3 H'}),
  work_boost_long:product('Zmiana premium',400,'consumable','boosts','epic','Przez 12 godzin wypłata z /praca jest mnożona ×1,5. Daily i weekly pozostają bez zmian.',{effect:'work',multiplier:1.5,durationMs:43_200_000,icon:'ticket',tag:'1,5× PRACA • 12 H'}),

  title_storm:product('Tytuł: Władca Burzy',3000,'title','titles','epic','Tytuł kolekcjonerski widoczny na karcie profilu.',{title:'WŁADCA BURZY',icon:'crown',tag:'TYTUŁ'}),
  title_shadow:product('Tytuł: Cień Nocy',3000,'title','titles','epic','Ciemny tytuł kolekcjonerski do profilu.',{title:'CIEŃ NOCY',icon:'crown',tag:'TYTUŁ'}),
  title_legend:product('Tytuł: Żywa Legenda',6000,'title','titles','legendary','Rzadki tytuł dla aktywnych członków społeczności.',{title:'ŻYWA LEGENDA',icon:'trophy',tag:'TYTUŁ'}),
  title_zerqon:product('Tytuł: Strażnik Wymiaru',4500,'title','titles','epic','Tytuł związany z Wymiarem ZERQONA. Nie nadaje uprawnień.',{title:'STRAŻNIK WYMIARU',icon:'shield',tag:'TYTUŁ'}),
  title_void:product('Tytuł: Władca Otchłani',9000,'title','titles','legendary','Kolekcjonerski tytuł do wyróżnienia profilu.',{title:'WŁADCA OTCHŁANI',icon:'crown',tag:'TYTUŁ'}),
  title_origin:product('Tytuł: Podróżnik',900,'title','titles','rare','Prosty tytuł na początek kolekcji.',{title:'PODRÓŻNIK',icon:'ticket',tag:'NA START'}),
  title_eclipse:product('Tytuł: Władca Zaćmienia',12000,'title','titles','legendary','Najdroższy tytuł kolekcjonerski w podstawowym sklepie.',{title:'WŁADCA ZAĆMIENIA',icon:'trophy',tag:'TYTUŁ'}),

  theme_amethyst:product('Styl: Ametyst',2500,'theme','themes','epic','Jaśniejszy fiolet, mocniejszy kontrast i bardziej komiksowe akcenty kart.',{theme:'amethyst',icon:'brush',tag:'WYGLĄD'}),
  theme_obsidian:product('Styl: Obsydian',2500,'theme','themes','epic','Prawie czarne karty z białym szkicem i chłodnymi detalami.',{theme:'obsidian',icon:'brush',tag:'WYGLĄD'}),
  theme_eclipse:product('Styl: Zaćmienie',5000,'theme','themes','legendary','Głęboka czerń i intensywniejszy fiolet w kartach profilu.',{theme:'eclipse',icon:'brush',tag:'WYGLĄD'}),

  frame_orbit:product('Ramka: Orbita',1600,'frame','frames','rare','Ręcznie rysowane pierścienie wokół awatara.',{frame:'orbit',icon:'orbit',tag:'RAMKA'}),
  // Zachowany legacy id/frame, żeby stare zakupy nie zniknęły z bazy.
  frame_crystal:product('Ramka: Szkic',3200,'frame','frames','epic','Rysunkowe punkty i znaczniki wokół awatara — bez motywu kryształu.',{frame:'crystal',icon:'frame',tag:'RAMKA'}),
  frame_crown:product('Ramka: Korona',7000,'frame','frames','legendary','Komiksowa korona nad awatarem. To tylko element wyglądu.',{frame:'crown',icon:'crown',tag:'RAMKA'}),
});

export const permanent=item=>item&&item.type!=='consumable';
export function itemRules(item){
  if(item.type==='consumable')return `${item.effect==='xp'?'Działa na XP z wiadomości i aktywnego VC.':'Działa wyłącznie na wypłaty z /praca.'} Boost jest czasowy. Kolejna sztuka tego samego mnożnika dopisuje czas; inny mnożnik tego samego efektu włączysz po zakończeniu aktywnego.`;
  return 'Kupujesz raz. Przedmiot zostaje w kolekcji i możesz go zakładać ponownie bez dodatkowej opłaty.';
}
