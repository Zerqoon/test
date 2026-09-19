/* ─────────────────────────────────────────────────────────────
   WYMIAR ZERQONA — SHOP
───────────────────────────────────────────────────────────── */

export const items = Object.freeze({

  /* ═══════════════════════════════════════════════════════════
     BOOSTY
  ═══════════════════════════════════════════════════════════ */

  xp_boost: {
    name: '✦ Iskra Doświadczenia',
    shortName: 'Iskra Doświadczenia',

    price: 1800,

    type: 'consumable',
    category: 'boost',

    rarity: 'rare',
    rarityName: 'RARE',

    icon: '✦',

    description:
      '+50% XP przez 60 minut. Efekt sumuje się z rolą Booster.',

    effect: '+50% XP',
    duration: '60 minut',

    details: [
      '+50% zdobywanego doświadczenia',
      'Działa przez 60 minut',
      'Łączy się z bonusem roli Booster',
      'Przedmiot zostaje zużyty po aktywacji',
    ],
  },


  /* ═══════════════════════════════════════════════════════════
     RARE TITLES
  ═══════════════════════════════════════════════════════════ */

  title_storm: {
    name: 'ϟ Tytuł: Władca Burzy',
    shortName: 'Władca Burzy',

    price: 3000,

    type: 'title',
    category: 'title',

    rarity: 'rare',
    rarityName: 'RARE',

    icon: 'ϟ',

    title: 'WŁADCA BURZY',

    description:
      'Kosmetyczny tytuł wyświetlany na karcie profilu.',

    effect: 'Tytuł profilu',
    duration: 'Na stałe',

    details: [
      'Odblokowuje tytuł WŁADCA BURZY',
      'Widoczny na karcie /profil',
      'Możesz zmienić go na inny tytuł',
      'Przedmiot pozostaje w kolekcji',
    ],
  },

  title_shadow: {
    name: '◆ Tytuł: Cień Nocy',
    shortName: 'Cień Nocy',

    price: 3000,

    type: 'title',
    category: 'title',

    rarity: 'rare',
    rarityName: 'RARE',

    icon: '◆',

    title: 'CIEŃ NOCY',

    description:
      'Mroczny tytuł kosmetyczny dla twojego profilu.',

    effect: 'Tytuł profilu',
    duration: 'Na stałe',

    details: [
      'Odblokowuje tytuł CIEŃ NOCY',
      'Widoczny na /profil',
      'Nie wpływa na ekonomię ani XP',
      'Można przełączać między tytułami',
    ],
  },


  /* ═══════════════════════════════════════════════════════════
     EPIC TITLES
  ═══════════════════════════════════════════════════════════ */

  title_void: {
    name: '◈ Tytuł: Strażnik Otchłani',
    shortName: 'Strażnik Otchłani',

    price: 3800,

    type: 'title',
    category: 'title',

    rarity: 'epic',
    rarityName: 'EPIC',

    icon: '◈',

    title: 'STRAŻNIK OTCHŁANI',

    description:
      'Rzadki tytuł inspirowany najgłębszymi warstwami Wymiaru Zerqona.',

    effect: 'Tytuł profilu',
    duration: 'Na stałe',

    details: [
      'Odblokowuje STRAŻNIK OTCHŁANI',
      'Rzadkość EPIC',
      'Widoczny na karcie profilu',
      'Przedmiot kosmetyczny',
    ],
  },

  title_arcane: {
    name: '✧ Tytuł: Mistrz Arkanów',
    shortName: 'Mistrz Arkanów',

    price: 4200,

    type: 'title',
    category: 'title',

    rarity: 'epic',
    rarityName: 'EPIC',

    icon: '✧',

    title: 'MISTRZ ARKANÓW',

    description:
      'Mistyczny tytuł dla użytkowników wyróżniających się aktywnością.',

    effect: 'Tytuł profilu',
    duration: 'Na stałe',

    details: [
      'Odblokowuje MISTRZ ARKANÓW',
      'Rzadkość EPIC',
      'Widoczny na /profil',
      'Pozostaje w kolekcji',
    ],
  },

  title_nightmare: {
    name: '◇ Tytuł: Koszmar Wymiaru',
    shortName: 'Koszmar Wymiaru',

    price: 4500,

    type: 'title',
    category: 'title',

    rarity: 'epic',
    rarityName: 'EPIC',

    icon: '◇',

    title: 'KOSZMAR WYMIARU',

    description:
      'Mroczny tytuł dla mieszkańców, których zna cały Wymiar Zerqona.',

    effect: 'Tytuł profilu',
    duration: 'Na stałe',

    details: [
      'Odblokowuje KOSZMAR WYMIARU',
      'Rzadkość EPIC',
      'Widoczny na profilu',
      'Kosmetyczny przedmiot kolekcjonerski',
    ],
  },


  /* ═══════════════════════════════════════════════════════════
     LEGENDARY TITLES
  ═══════════════════════════════════════════════════════════ */

  title_zerqona: {
    name: '✦ Tytuł: Wybraniec Zerqona',
    shortName: 'Wybraniec Zerqona',

    price: 5200,

    type: 'title',
    category: 'title',

    rarity: 'legendary',
    rarityName: 'LEGENDARY',

    icon: '✦',

    title: 'WYBRANIEC ZERQONA',

    description:
      'Legendarny tytuł związany bezpośrednio z Wymiarem Zerqona.',

    effect: 'Legendarny tytuł',
    duration: 'Na stałe',

    details: [
      'Odblokowuje WYBRANIEC ZERQONA',
      'Rzadkość LEGENDARY',
      'Ekskluzywny tytuł serwerowy',
      'Widoczny na /profil',
    ],
  },

  title_emperor: {
    name: '♛ Tytuł: Cesarz Otchłani',
    shortName: 'Cesarz Otchłani',

    price: 5600,

    type: 'title',
    category: 'title',

    rarity: 'legendary',
    rarityName: 'LEGENDARY',

    icon: '♛',

    title: 'CESARZ OTCHŁANI',

    description:
      'Legendarny tytuł dla najbardziej wpływowych mieszkańców wymiaru.',

    effect: 'Legendarny tytuł',
    duration: 'Na stałe',

    details: [
      'Odblokowuje CESARZ OTCHŁANI',
      'Rzadkość LEGENDARY',
      'Widoczny na profilu',
      'Przedmiot kolekcjonerski',
    ],
  },

  title_legend: {
    name: '★ Tytuł: Żywa Legenda',
    shortName: 'Żywa Legenda',

    price: 6000,

    type: 'title',
    category: 'title',

    rarity: 'legendary',
    rarityName: 'LEGENDARY',

    icon: '★',

    title: 'ŻYWA LEGENDA',

    description:
      'Prestiżowy tytuł dla najbardziej rozpoznawalnych użytkowników.',

    effect: 'Legendarny tytuł',
    duration: 'Na stałe',

    details: [
      'Odblokowuje ŻYWA LEGENDA',
      'Rzadkość LEGENDARY',
      'Widoczny na karcie profilu',
      'Jeden z droższych tytułów w sklepie',
    ],
  },


  /* ═══════════════════════════════════════════════════════════
     MYTHIC TITLES
  ═══════════════════════════════════════════════════════════ */

  title_eternal: {
    name: '✺ Tytuł: Wieczny Wędrowiec',
    shortName: 'Wieczny Wędrowiec',

    price: 7500,

    type: 'title',
    category: 'title',

    rarity: 'mythic',
    rarityName: 'MYTHIC',

    icon: '✺',

    title: 'WIECZNY WĘDROWIEC',

    description:
      'Mityczny tytuł dla użytkowników, którzy zapisali się w historii serwera.',

    effect: 'Mityczny tytuł',
    duration: 'Na stałe',

    details: [
      'Odblokowuje WIECZNY WĘDROWIEC',
      'Rzadkość MYTHIC',
      'Bardzo wysoki prestiż',
      'Widoczny na /profil',
    ],
  },

  title_dimension: {
    name: '◆ Tytuł: Władca Wymiaru',
    shortName: 'Władca Wymiaru',

    price: 9000,

    type: 'title',
    category: 'title',

    rarity: 'mythic',
    rarityName: 'MYTHIC',

    icon: '◆',

    title: 'WŁADCA WYMIARU',

    description:
      'Jeden z najbardziej prestiżowych tytułów dostępnych w Wymiarze Zerqona.',

    effect: 'Mityczny tytuł',
    duration: 'Na stałe',

    details: [
      'Odblokowuje WŁADCA WYMIARU',
      'Rzadkość MYTHIC',
      'Najwyższa półka sklepu',
      'Widoczny na karcie profilu',
    ],
  },

  title_archon: {
    name: '♜ Tytuł: Archont Zerqona',
    shortName: 'Archont Zerqona',

    price: 11000,

    type: 'title',
    category: 'title',

    rarity: 'mythic',
    rarityName: 'MYTHIC',

    icon: '♜',

    title: 'ARCHONT ZERQONA',

    description:
      'Ekskluzywny mityczny tytuł przeznaczony dla najbogatszych użytkowników.',

    effect: 'Mityczny tytuł',
    duration: 'Na stałe',

    details: [
      'Odblokowuje ARCHONT ZERQONA',
      'Rzadkość MYTHIC',
      'Ekskluzywny przedmiot sklepu',
      'Jeden z najdroższych tytułów',
    ],
  },

  title_ascended: {
    name: '✧ Tytuł: Wyniesiony',
    shortName: 'Wyniesiony',

    price: 14000,

    type: 'title',
    category: 'title',

    rarity: 'mythic',
    rarityName: 'MYTHIC',

    icon: '✧',

    title: 'WYNIESIONY',

    description:
      'Najbardziej prestiżowy tytuł dostępny obecnie w sklepie.',

    effect: 'Mityczny tytuł',
    duration: 'Na stałe',

    details: [
      'Odblokowuje tytuł WYNIESIONY',
      'Najwyższa rzadkość sklepu',
      'Najdroższy przedmiot kosmetyczny',
      'Widoczny na karcie profilu',
    ],
  },
});


/* ─────────────────────────────────────────────────────────────
   SHOP METADATA
───────────────────────────────────────────────────────────── */

export const rarityInfo = Object.freeze({
  rare: {
    name: 'RARE',
    color: '#6EA8FF',
    icon: '◆',
  },

  epic: {
    name: 'EPIC',
    color: '#B56CFF',
    icon: '◈',
  },

  legendary: {
    name: 'LEGENDARY',
    color: '#FFB74D',
    icon: '★',
  },

  mythic: {
    name: 'MYTHIC',
    color: '#FF6ACD',
    icon: '✦',
  },
});


/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */

export function getItem(id) {
  return items[id] || null;
}

export function getItems() {
  return Object.entries(items).map(
    ([id, item]) => ({
      id,
      ...item,
    }),
  );
}

export function getItemsByType(type) {
  return Object.entries(items)
    .filter(
      ([, item]) =>
        item.type === type,
    )
    .map(
      ([id, item]) => ({
        id,
        ...item,
      }),
    );
}

export function getItemsByCategory(category) {
  return Object.entries(items)
    .filter(
      ([, item]) =>
        item.category === category,
    )
    .map(
      ([id, item]) => ({
        id,
        ...item,
      }),
    );
}

export function getItemsByRarity(rarity) {
  return Object.entries(items)
    .filter(
      ([, item]) =>
        item.rarity === rarity,
    )
    .map(
      ([id, item]) => ({
        id,
        ...item,
      }),
    );
}
