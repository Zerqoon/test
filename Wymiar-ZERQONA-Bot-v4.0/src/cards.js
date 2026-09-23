export async function profileCard(user, row, rank, roleName = 'Wędrowiec') {
  const { cv, ctx, c } = surface(930, 'KARTA PROFILU // SYSTEM WYMIARU', row.card_theme, 'STATUS: POŁĄCZONO • DANE SYNCHRONIZOWANE');
  const p = progressForXp(row.xp);
  const inventory = row.inventory || [];
  const ach = row.achievements || [];
  const now = Date.now();

  // ==========================================
  // 1. HERO PANEL (GŁÓWNY IDENTYFIKATOR)
  // ==========================================
  panel(ctx, 48, 124, 1344, 304, c, true);

  // Avatar z ramką
  avatar(ctx, user, 185, 260, 84, c, await avatarImage(user.avatarURL), row.avatar_frame);

  // Ranga / Rola użytkownika
  pill(ctx, roleName.toUpperCase(), 312, 156, 240, c);

  // Dane użytkownika
  fit(ctx, user.name, 312, 230, 44, 660, white, 'left');
  text(ctx, `@${user.username || user.name}`, 314, 262, 15, muted, false, 650);

  // Tytuł / Motto gracza w wyróżnionym boksie
  box(ctx, 312, 282, 680, 38, { radius: 8, fill: '#0B091099', stroke: '#2A2234', lineWidth: 1 });
  text(ctx, (row.title || 'TWOJA HISTORIA DOPIERO SIĘ ZACZYNA').toUpperCase(), 326, 306, 13, c.bright, true, 650);

  // Pasek postępu poziomu
  text(ctx, `POZIOM ${p.level} → ${p.level + 1}`, 314, 356, 12, muted, true);
  text(ctx, `${fmt(p.current)} / ${fmt(p.required)} XP (${Math.floor(p.fraction * 100)}%)`, 992, 356, 13, c.bright, true, 300, 'right');
  bar(ctx, 312, 372, 680, p.fraction, c, 16);

  // Pierścień poziomu & Globalna pozycja (Prawa strona Hero)
  ring(ctx, 1215, 252, 92, p.fraction, c);
  text(ctx, 'POZIOM', 1215, 222, 11, muted, true, 120, 'center');
  fit(ctx, p.level, 1215, 292, 74, 150, white, 'center');
  
  box(ctx, 1095, 362, 240, 36, { radius: 10, fill: '#140F1D', stroke: `${c.accent}55`, lineWidth: 1 });
  text(ctx, `#${fmt(rank)} W RANKINGU`, 1215, 385, 13, c.bright, true, 220, 'center');

  // ==========================================
  // 2. STATYSTYKI KLUCZOWE (GRID 4 METRYK)
  // ==========================================
  const metrics = [
    ['PORTFEL', `${fmt(row.balance)} ZC`, 'Dostępne monety', 'coin'],
    ['BANK', `${fmt(row.bank || 0)} ZC`, 'Bezpieczny skarbiec', 'bank'],
    ['CZAT', fmt(row.messages), 'Wysłane wiadomości', 'chat'],
    ['VOICE', duration(row.voice_seconds), 'Spędzony czas na VC', 'headset']
  ];

  metrics.forEach(([label, value, desc, icon], n) => {
    metric(ctx, 48 + n * 344, 452, 312, 140, label, value, desc, c, icon);
  });

  // ==========================================
  // 3. ŚCIEŻKA ROZWOJU & AKTYWNE BONUSY (DÓŁ LEWA)
  // ==========================================
  panel(ctx, 48, 616, 856, 260, c);
  
  text(ctx, 'KAMIEŃ MILOWY / ŚCIEŻKA POZIOMÓW', 74, 650, 13, c.bright, true);
  text(ctx, `${fmt(row.xp)} XP ŁĄCZNIE`, 876, 650, 12, muted, true, 260, 'right');
  
  // Kamienie milowe
  milestones(ctx, 72, 674, 808, row.xp, c);
  line(ctx, 74, 762, 876, 762, '#2C2237');

  // Chipy statusowe dla mnożników (Zamiast surowego tekstu)
  const isXpBoosted = row.booster_until > now;
  const isWorkBoosted = row.work_boost_until > now;
  const streak = activeStreak(row, now);

  const chips = [
    { label: 'XP BOOST', val: `${row.xp_multiplier || (isXpBoosted ? 1.5 : 1)}×`, active: isXpBoosted || row.multiplier > 1 },
    { label: 'PRACA', val: `${row.work_multiplier || (isWorkBoosted ? 1.5 : 1)}×`, active: isWorkBoosted },
    { label: 'DAILY STREAK', val: `${streak} DNI`, active: streak > 0 }
  ];

  chips.forEach((chip, i) => {
    const cx = 74 + i * 270;
    box(ctx, cx, 784, 252, 62, { 
      radius: 10, 
      fill: chip.active ? '#1A1424' : '#120E19', 
      stroke: chip.active ? `${c.accent}88` : '#2C2237', 
      lineWidth: 1.5 
    });
    text(ctx, chip.label, cx + 18, 810, 10, muted, true);
    text(ctx, chip.val, cx + 18, 834, 18, chip.active ? c.bright : white, true);
    artifact(ctx, chip.active ? 'star' : 'clock', cx + 214, 815, 18, c);
  });

  // ==========================================
  // 4. EKWIPUNEK I KOLEKCJA (DÓŁ PRAWA)
  // ==========================================
  panel(ctx, 928, 616, 464, 260, c);
  artifact(ctx, 'crown', 1332, 676, 42, c);
  
  text(ctx, 'SKARBIEC KOSMETYCZNY', 954, 650, 13, c.bright, true);
  
  const totalPermanent = Object.values(items).filter(permanent).length;
  text(ctx, `${countPermanent(inventory)} / ${totalPermanent}`, 952, 706, 38, white, true);
  text(ctx, 'ODBLOKOWANE PRZEDMIOTY STAŁE', 954, 730, 10, muted, true);

  line(ctx, 954, 754, 1362, 754, '#2C2237');

  // Osiągnięcia i motyw z ikonami
  const claimedAch = ach.filter(a => a.claimed).length;
  text(ctx, 'OSIĄGNIĘCIA', 954, 786, 11, muted, true);
  text(ctx, `${claimedAch} / ${ach.length || 8} odebranych`, 1362, 786, 14, c.bright, true, 200, 'right');

  text(ctx, 'MOTYW KARTY', 954, 824, 11, muted, true);
  text(ctx, (themes[row.card_theme] || themes.default).name.toUpperCase(), 1362, 824, 13, white, true, 200, 'right');

  return png(cv);
}
