const product=(name,price,type,category,rarity,description,extra={})=>Object.freeze({name,price,type,category,rarity,description,...extra});
export const shopCategories=Object.freeze({all:'Cały sklep',boosts:'Wzmocnienia',titles:'Tytuły',themes:'Motywy kart',frames:'Ramki awatara'});
export const rarityNames=Object.freeze({rare:'Rzadki',epic:'Epicki',legendary:'Legendarny'});
export const items=Object.freeze({
  xp_boost:product('Iskra doświadczenia',1800,'consumable','boosts','rare','Zdobądź 50% więcej XP z wiadomości i rozmów przez godzinę.',{effect:'xp',multiplier:1.5,durationMs:3600000,icon:'crystal',tag:'+50% XP'}),
  xp_boost_long:product('Rdzeń doświadczenia',9000,'consumable','boosts','epic','Sześć godzin bonusu 1,5× XP. Ten sam efekt co Iskra, z dłuższym czasem działania.',{effect:'xp',multiplier:1.5,durationMs:21600000,icon:'crystal',tag:'6 GODZIN'}),
  xp_boost_power:product('Przebudzenie Wymiaru',4000,'consumable','boosts','legendary','Podwójne XP przez godzinę. Z rolą Booster daje łącznie 4× XP.',{effect:'xp',multiplier:2,durationMs:3600000,icon:'crystal',tag:'2× XP'}),
  work_boost:product('Kontrakt specjalny',120,'consumable','boosts','rare','Praca wypłaca o 50% więcej monet przez 3 godziny. Odstęp 45 minut nadal obowiązuje.',{effect:'work',multiplier:1.5,durationMs:10800000,icon:'bolt',tag:'+50% PRACA'}),
  work_boost_long:product('Kontrakt elity',400,'consumable','boosts','epic','Bonus 1,5× do wynagrodzenia za pracę przez 12 godzin. Nie zwiększa daily ani weekly.',{effect:'work',multiplier:1.5,durationMs:43200000,icon:'bolt',tag:'12 GODZIN'}),
  title_storm:product('Tytuł: Władca Burzy',3000,'title','titles','epic','Stały tytuł wyświetlany na profilu. Kup raz i zakładaj dowolną liczbę razy.',{title:'WŁADCA BURZY',icon:'crown',tag:'KOLEKCJA'}),
  title_shadow:product('Tytuł: Cień Nocy',3000,'title','titles','epic','Tytuł dla tych, którzy najlepiej czują się po ciemnej stronie Wymiaru.',{title:'CIEŃ NOCY',icon:'crown',tag:'KOLEKCJA'}),
  title_legend:product('Tytuł: Żywa Legenda',6000,'title','titles','legendary','Legendarny tytuł widoczny na karcie członka. Pozostaje w kolekcji po zdjęciu.',{title:'ŻYWA LEGENDA',icon:'crown',tag:'PRESTIŻ'}),
  title_zerqon:product('Tytuł: Strażnik Wymiaru',4500,'title','titles','epic','Symbol przynależności do Wymiaru ZERQONA. Stały przedmiot kolekcji.',{title:'STRAŻNIK WYMIARU',icon:'crown',tag:'WYMIAR'}),
  title_void:product('Tytuł: Władca Otchłani',9000,'title','titles','legendary','Najwyższy tytuł mrocznej kolekcji. Widoczny na karcie profilu.',{title:'WŁADCA OTCHŁANI',icon:'crown',tag:'PRESTIŻ'}),
  title_origin:product('Tytuł: Podróżnik',900,'title','titles','rare','Pierwszy znak Twojej podróży przez Wymiar. Dostępny na początek kolekcji.',{title:'PODRÓŻNIK',icon:'crown',tag:'NA START'}),
  title_eclipse:product('Tytuł: Władca Zaćmienia',12000,'title','titles','legendary','Ekskluzywny tytuł kolekcjonerski; nie nadaje uprawnień administracyjnych.',{title:'WŁADCA ZAĆMIENIA',icon:'crown',tag:'KOLEKCJONER'}),
  theme_amethyst:product('Motyw: Ametyst',2500,'theme','themes','epic','Jaśniejsza fioletowa poświata i ametystowe akcenty kart. Zmienia profil, rangę i portfel.',{theme:'amethyst',icon:'palette',tag:'WYGLĄD'}),
  theme_obsidian:product('Motyw: Obsydian',2500,'theme','themes','epic','Głęboka czerń i srebrnobiałe akcenty. Zachowuje układ i dane Twoich kart.',{theme:'obsidian',icon:'palette',tag:'WYGLĄD'}),
  theme_eclipse:product('Motyw: Zaćmienie',5000,'theme','themes','legendary','Ciemne śliwkowe panele oraz intensywna fioletowa energia. Stały motyw kart.',{theme:'eclipse',icon:'palette',tag:'WYGLĄD'}),
  frame_orbit:product('Ramka: Orbita',1600,'frame','frames','rare','Orbitalne pierścienie i punkty energii wokół awatara na profilu i randze.',{frame:'orbit',icon:'orbit',tag:'AWATAR'}),
  frame_crystal:product('Ramka: Kryształ',3200,'frame','frames','epic','Geometryczna ramka z wyraźnymi narożnikami w barwach wybranego motywu.',{frame:'crystal',icon:'crystal',tag:'AWATAR'}),
  frame_crown:product('Ramka: Korona Wymiaru',7000,'frame','frames','legendary','Ozdobna ramka z koroną i detalami światła. Element wyglądu, bez dodatkowych uprawnień.',{frame:'crown',icon:'crown',tag:'AWATAR'}),
});
export const permanent=item=>item&&item.type!=='consumable';
export function itemRules(item){
  if(item.type==='consumable')return `${item.effect==='xp'?'Wiadomości i aktywne VC':'Tylko nagrody /praca'}. Kolejne sztuki tego samego mnożnika wydłużają czas. Różne mnożniki tego samego efektu nie łączą się.`;
  return 'Kupujesz raz. Przedmiot pozostaje w kolekcji i nie zużywa się po założeniu. Jednocześnie aktywny jest jeden przedmiot danego typu.';
}
