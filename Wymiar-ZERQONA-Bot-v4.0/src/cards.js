export async function rankCard(user, row, rank, roleName = 'Wędrowiec') {
  const { cv, ctx, c } = surface(590, 'KARTA POZIOMU // STATUS I POSTĘP', row.card_theme, 'SYSTEM LEVELOWANIA • STATYSTYKI CZASU RZECZYWISTEGO');
  const p = progressForXp(row.xp);
  const now = Date.now();
  const isXpBoosted = row.booster_until > now || (row.multiplier && row.multiplier > 1);
  const xpMult = row.xp_multiplier || row.multiplier || 1.5;

  // Główny kontener HUD
  panel(ctx, 48, 124, 1344, 404, c, true);

  // Avatar z ramką i poświatą
  avatar(ctx, user, 175, 252, 78, c, await avatarImage(user.avatarURL), row.avatar_frame);

  // Badge rangi i nazwa gracza
  pill(ctx, roleName.toUpperCase(), 290, 160, 220, c);
  fit(ctx, user.name, 290, 234, 42, 650, white, 'left');
  text(ctx, `@${user.username || user.name}`, 292, 266, 15, muted, false, 600);

  // Pozycja w rankingu (Badge obok nicku)
  box(ctx, 290, 286, 260, 36, { radius: 8, fill: '#0E0B14', stroke: `${c.accent}66`, lineWidth: 1 });
  artifact(ctx, 'trophy', 310, 304, 14, c);
  text(ctx, `POZYCJA W RANKINGU: #${fmt(rank)}`, 332, 309, 12, c.bright, true, 210);

  // Pierścień poziomu (Prawa strona)
  ring(ctx, 1225, 248, 88, p.fraction, c);
  text(ctx, 'POZIOM', 1225, 218, 11, muted, true, 120, 'center');
  fit(ctx, p.level, 1225, 288, 72, 140, white, 'center');
  text(ctx, `${Math.floor(p.fraction * 100)}%`, 1225, 316, 13, c.bright, true, 100, 'center');

  // Separator
  line(ctx, 74, 346, 1362, 346, '#281F33');

  // Pasek postępu i wartości liczbowe XP
  text(ctx, 'POSTĘP DOŚWIADCZENIA', 76, 376, 12, muted, true);
  text(ctx, `${fmt(p.current)} / ${fmt(p.required)} XP`, 1364, 376, 16, c.bright, true, 400, 'right');
  bar(ctx, 74, 392, 1290, p.fraction, c, 18);

  // Dolny pasek informacyjny (Chipy metryk)
  const remaining = Math.max(0, p.required - p.current);
  const badges = [
    { label: 'ŁĄCZNE XP', val: `${fmt(row.xp)} XP`, icon: 'star' },
    { label: 'BRAKUJE DO AWANSU', val: `${fmt(remaining)} XP`, icon: 'clock' },
    { label: 'MNOŻNIK XP', val: isXpBoosted ? `${xpMult}× AKTYWNY` : '1.0× STANDARD', icon: 'bolt', active: isXpBoosted }
  ];

  badges.forEach((b, i) => {
    const bx = 74 + i * 440;
    box(ctx, bx, 434, 410, 68, {
      radius: 10,
      fill: b.active ? '#1A1326' : '#110D18',
      stroke: b.active ? c.accent : '#2C2237',
      lineWidth: 1.5
    });
    artifact(ctx, b.icon, bx + 34, 468, 20, c);
    text(ctx, b.label, bx + 68, 456, 10, muted, true);
    text(ctx, b.val, bx + 68, 482, 16, b.active ? c.bright : white, true);
  });

  return png(cv);
}
