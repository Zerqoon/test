export const items = Object.freeze({
  /* ─────────────────────────────────────────────────────────
     BOOSTY
  ───────────────────────────────────────────────────────── */

  xp_boost: {
    name: 'Iskra Doświadczenia',
    shortName: 'Iskra XP',

    price: 1800,

    type: 'consumable',
    category: 'boost',

    rarity: 'rare',

    icon: '✦',

    description:
      '+50% XP przez 60 minut. Efekt może działać razem z bonusem roli Booster.',

    effectLabel: '+50% XP',
    durationLabel: '60 minut',

    details: [
      '+50% zdobywanego XP',
      'Czas działania: 60 minut',
      'Łączy się z bonusem Booster',
      'Zużywany po aktywacji',
    ],
  },


  /* ─────────────────────────────────────────────────────────
     TYTUŁY — STANDARD
  ───────────────────────────────────────────────────────── */

  title_storm: {
    name: 'Tytuł: Władca Burzy',
    shortName: 'Władca Burzy',

    price: 3000,

    type: 'title',
    category: 'title',

    rarity: 'rare',

    icon: 'ϟ',

    title: 'WŁADCA BURZY',

    description:
      'Kosmetyczny tytuł wyświetlany na karcie profilu.',

    effectLabel: 'Tytuł profilu',
    durationLabel: 'Na stałe',

    details: [
      'Odblokowuje tytuł WŁADCA BURZY',
      'Widoczny na karcie profilu',
      'Można zmienić na inny tytuł',
      'Nie znika po użyciu',
    ],
  },

  title_shadow: {
    name: 'Tytuł: Cień Nocy',
    shortName: 'Cień Nocy',

    price: 3000,

    type: 'title',
    category: 'title',

    rarity: 'rare',

    icon: '◆',

    title: 'CIEŃ NOCY',

    description:
      'Mroczny tytuł kosmetyczny wyświetlany na profilu.',

    effectLabel: 'Tytuł profilu',
    durationLabel: 'Na stałe',

    details: [
      'Odblokowuje tytuł CIEŃ NOCY',
      'Widoczny na karcie profilu',
      'Kosmetyczny przedmiot',
      'Nie daje przewagi ekonomicznej',
    ],
  },


  /* ─────────────────────────────────────────────────────────
     TYTUŁY — EPIC
  ───────────────────────────────────────────────────────── */

  title_void: {
    name: 'Tytuł: Strażnik Otchłani',
    shortName: 'Strażnik Otchłani',

    price: 3800,

    type: 'title',
    category: 'title',

    rarity: 'epic',

    icon: '◈',

    title: 'STRAŻNIK OTCHŁANI',

    description:
      'Ekskluzywny tytuł dla mieszkańców głębszych warstw Wymiaru Zerqona.',

    effectLabel: 'Tytuł profilu',
    durationLabel: 'Na stałe',

    details: [
      'Odblokowuje STRAŻNIK OTCHŁANI',
      'Wyższa rzadkość kosmetyczna',
      'Widoczny na profilu',
      'Możliwość zmiany tytułu',
    ],
  },

  title_nightmare: {
    name: 'Tytuł: Koszmar Wymiaru',
    shortName: 'Koszmar Wymiaru',

    price: 4200,

    type: 'title',
    category: 'title',

    rarity: 'epic',

    icon: '◇',

    title: 'KOSZMAR WYMIARU',

    description:
      'Tytuł dla użytkowników, którzy chcą wyróżnić swój profil.',

    effectLabel: 'Tytuł profilu',
    durationLabel: 'Na stałe',

    details: [
      'Odblokowuje KOSZMAR WYMIARU',
      'Kosmetyczny przedmiot Epic',
      'Widoczny na profilu',
      'Pozostaje w kolekcji',
    ],
  },

  title_arcane: {
    name: 'Tytuł: Mistrz Arkanów',
    shortName: 'Mistrz Arkanów',

    price: 4500,

    type: 'title',
    category: 'title',

    rarity: 'epic',

    icon: '✧',

    title: 'MISTRZ ARKANÓW',

    description:
      'Mistyczny tytuł dla najbardziej aktywnych mieszkańców serwera.',

    effectLabel: 'Tytuł profilu',
    durationLabel: 'Na stałe',

    details: [
      'Odblokowuje MISTRZ ARKANÓW',
      'Rzadkość Epic',
      'Widoczny na profilu',
      'Przedmiot kosmetyczny',
    ],
  },


  /* ─────────────────────────────────────────────────────────
     TYTUŁY — LEGENDARY
  ───────────────────────────────────────────────────────── */

  title_zerqona: {
    name: 'Tytuł: Wybraniec Zerqona',
    shortName: 'Wybraniec Zerqona',

    price: 5000,

    type: 'title',
    category: 'title',

    rarity: 'legendary',

    icon: '✦',

    title: 'WYBRANIEC ZERQONA',

    description:
      'Legendarny tytuł związany bezpośrednio z Wymiarem Zerqona.',

    effectLabel: 'Legendarny tytuł',
    durationLabel: 'Na stałe',

    details: [
      'Odblokowuje WYBRANIEC ZERQONA',
      'Legendarny przedmiot kosmetyczny',
      'Widoczny na profilu',
      'Ekskluzywny tytuł serwerowy',
    ],
  },

  title_emperor: {
    name: 'Tytuł: Cesarz Otchłani',
    shortName: 'Cesarz Otchłani',

    price: 5500,

    type: 'title',
    category: 'title',

    rarity: 'legendary',

    icon: '♛',

    title: 'CESARZ OTCHŁANI',

    description:
      'Legendarny tytuł przeznaczony dla bogatszych użytkowników.',

    effectLabel: 'Legendarny tytuł',
    durationLabel: 'Na stałe',

    details: [
      'Odblokowuje CESARZ OTCHŁANI',
      'Rzadkość Legendary',
      'Widoczny na profilu',
      'Przedmiot kolekcjonerski',
    ],
  },

  title_legend: {
    name: 'Tytuł: Żywa Legenda',
    shortName: 'Żywa Legenda',

    price: 6000,

    type: 'title',
    category: 'title',

    rarity: 'legendary',

    icon: '★',

    title: 'ŻYWA LEGENDA',

    description:
      'Jeden z najbardziej prestiżowych tytułów dostępnych w sklepie.',

    effectLabel: 'Legendarny tytuł',
    durationLabel: 'Na stałe',

    details: [
      'Odblokowuje ŻYWA LEGENDA',
      'Legendarny kosmetyk',
      'Widoczny na profilu',
      'Wysoki poziom prestiżu',
    ],
  },


  /* ─────────────────────────────────────────────────────────
     TYTUŁY — MYTHIC
  ───────────────────────────────────────────────────────── */

  title_eternal: {
    name: 'Tytuł: Wieczny Wędrowiec',
    shortName: 'Wieczny Wędrowiec',

    price: 7500,

    type: 'title',
    category: 'title',

    rarity: 'mythic',

    icon: '✺',

    title: 'WIECZNY WĘDROWIEC',

    description:
      'Mityczny tytuł dla najbardziej oddanych mieszkańców serwera.',

    effectLabel: 'Mityczny tytuł',
    durationLabel: 'Na stałe',

    details: [
      'Odblokowuje WIECZNY WĘDROWIEC',
      'Rzadkość Mythic',
      'Widoczny na profilu',
      'Ekskluzywny kosmetyk',
    ],
  },

  title_dimension: {
    name: 'Tytuł: Władca Wymiaru',
    shortName: 'Władca Wymiaru',

    price: 9000,

    type: 'title',
    category: 'title',

    rarity: 'mythic',

    icon: '◆',

    title: 'WŁADCA WYMIARU',

    description:
      'Jeden z najdroższych i najbardziej prestiżowych tytułów Zerqona.',

    effectLabel: 'Mityczny tytuł',
    durationLabel: 'Na stałe',

    details: [
      'Odblokowuje WŁADCA WYMIARU',
      'Najwyższa półka sklepu',
      'Widoczny na karcie profilu',
      'Mityczny przedmiot kosmetyczny',
    ],
  },
});


/* ─────────────────────────────────────────────────────────────
   SHOP HELPERS
───────────────────────────────────────────────────────────── */

export const rarityInfo = Object.freeze({
  common: {
    name: 'Common',
    color: '#A5A5B3',
  },

  rare: {
    name: 'Rare',
    color: '#6EA8FF',
  },

  epic: {
    name: 'Epic',
    color: '#B56CFF',
  },

  legendary: {
    name: 'Legendary',
    color: '#FFB74D',
  },

  mythic: {
    name: 'Mythic',
    color: '#FF6ACD',
  },
});


export function getItem(id) {
  return items[id] || null;
}


export function getItemsByCategory(category) {
  return Object.entries(items)
    .filter(([, item]) => item.category === category)
    .map(([id, item]) => ({
      id,
      ...item,
    }));
}
