import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createCanvas,
  loadImage,
  GlobalFonts,
} from '@napi-rs/canvas';

import {
  progressForXp,
  levelForXp,
} from './level.js';


/* ─────────────────────────────────────────────────────────────
   WYMIAR ZERQONA — CANVAS SYSTEM
───────────────────────────────────────────────────────────── */

const __dirname = path.dirname(
  fileURLToPath(import.meta.url),
);

const fontsPath = path.resolve(
  __dirname,
  '../assets/fonts',
);

GlobalFonts.registerFromPath(
  path.join(fontsPath, 'DejaVuSans.ttf'),
  'Zerqona',
);

GlobalFonts.registerFromPath(
  path.join(fontsPath, 'DejaVuSans-Bold.ttf'),
  'Zerqona Bold',
);


/* ─────────────────────────────────────────────────────────────
   THEME
───────────────────────────────────────────────────────────── */

const C = {
  bg: '#08080D',
  bg2: '#0D0D16',

  panel: '#11111B',
  panel2: '#171724',
  panel3: '#1C1C2C',

  purple: '#9D5CFF',
  purple2: '#C18AFF',
  purpleDark: '#5A2B9C',

  pink: '#EB6AD6',

  lime: '#BFFF69',

  white: '#F7F5FF',
  softWhite: '#DDD8E9',

  muted: '#89899B',
  muted2: '#626273',

  border: '#2B2B3D',
  borderLight: '#3B3150',

  danger: '#FF667D',

  gold: '#FFD45A',
  silver: '#D9D9E2',
  bronze: '#D8905E',
};

const fmt = (number) =>
  new Intl.NumberFormat('pl-PL').format(
    Number(number || 0),
  );


/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */

function font(
  ctx,
  size,
  bold = false,
) {
  ctx.font =
    `${size}px '${bold ? 'Zerqona Bold' : 'Zerqona'}'`;
}

function roundedPath(
  ctx,
  x,
  y,
  w,
  h,
  radius,
) {
  ctx.beginPath();
  ctx.roundRect(
    x,
    y,
    w,
    h,
    radius,
  );
}

function round(
  ctx,
  x,
  y,
  w,
  h,
  radius,
  fill,
  stroke = null,
  strokeWidth = 1,
) {
  roundedPath(
    ctx,
    x,
    y,
    w,
    h,
    radius,
  );

  ctx.fillStyle = fill;
  ctx.fill();

  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
}

function line(
  ctx,
  x1,
  y1,
  x2,
  y2,
  color,
  width = 1,
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function text(
  ctx,
  value,
  x,
  y,
  size,
  color = C.white,
  bold = false,
  maxWidth = null,
  align = 'left',
) {
  const str = String(
    value ?? '',
  );

  font(
    ctx,
    size,
    bold,
  );

  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = align;

  if (
    !maxWidth ||
    ctx.measureText(str).width <= maxWidth
  ) {
    ctx.fillText(
      str,
      x,
      y,
    );

    ctx.textAlign = 'left';
    return;
  }

  let clipped = str;

  while (
    clipped.length > 0 &&
    ctx.measureText(
      `${clipped}…`,
    ).width > maxWidth
  ) {
    clipped =
      clipped.slice(
        0,
        -1,
      );
  }

  ctx.fillText(
    `${clipped}…`,
    x,
    y,
  );

  ctx.textAlign = 'left';
}


function wrapText(
  ctx,
  value,
  x,
  y,
  maxWidth,
  lineHeight,
  maxLines = 2,
  size = 11,
  color = C.muted,
  bold = false,
) {
  const words = String(value ?? '').split(/\s+/).filter(Boolean);

  font(ctx, size, bold);
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    current = word;

    if (lines.length >= maxLines) break;
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (lines.length === maxLines) {
    const consumed = lines.join(' ').split(/\s+/).length;

    if (consumed < words.length) {
      let last = lines[maxLines - 1];

      while (
        last.length &&
        ctx.measureText(`${last}…`).width > maxWidth
      ) {
        last = last.slice(0, -1);
      }

      lines[maxLines - 1] = `${last}…`;
    }
  }

  lines.forEach((lineValue, index) => {
    ctx.fillText(
      lineValue,
      x,
      y + index * lineHeight,
    );
  });

  return lines.length;
}

function shadowCard(
  ctx,
  x,
  y,
  w,
  h,
  radius = 18,
  fill = 'rgba(18,18,30,.92)',
  stroke = C.border,
) {
  ctx.save();

  ctx.shadowColor =
    'rgba(0,0,0,.38)';

  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;

  round(
    ctx,
    x,
    y,
    w,
    h,
    radius,
    fill,
    stroke,
    1,
  );

  ctx.restore();
}

function glowLine(
  ctx,
  x,
  y,
  w,
  color = C.purple,
) {
  ctx.save();

  ctx.shadowColor = color;
  ctx.shadowBlur = 16;

  const gradient =
    ctx.createLinearGradient(
      x,
      0,
      x + w,
      0,
    );

  gradient.addColorStop(
    0,
    'rgba(157,92,255,0)',
  );

  gradient.addColorStop(
    0.25,
    color,
  );

  gradient.addColorStop(
    0.75,
    C.pink,
  );

  gradient.addColorStop(
    1,
    'rgba(235,106,214,0)',
  );

  ctx.fillStyle =
    gradient;

  ctx.fillRect(
    x,
    y,
    w,
    2,
  );

  ctx.restore();
}

function divider(
  ctx,
  x,
  y,
  w,
) {
  const g =
    ctx.createLinearGradient(
      x,
      0,
      x + w,
      0,
    );

  g.addColorStop(
    0,
    'rgba(255,255,255,0)',
  );

  g.addColorStop(
    0.12,
    'rgba(255,255,255,.08)',
  );

  g.addColorStop(
    0.88,
    'rgba(255,255,255,.08)',
  );

  g.addColorStop(
    1,
    'rgba(255,255,255,0)',
  );

  ctx.fillStyle = g;

  ctx.fillRect(
    x,
    y,
    w,
    1,
  );
}


/* ─────────────────────────────────────────────────────────────
   BACKGROUND
───────────────────────────────────────────────────────────── */

function base(
  width = 1080,
  height = 500,
  label = 'COMMUNITY',
) {
  const cv =
    createCanvas(
      width,
      height,
    );

  const ctx =
    cv.getContext('2d');


  /* BACKGROUND */

  const bg =
    ctx.createLinearGradient(
      0,
      0,
      width,
      height,
    );

  bg.addColorStop(
    0,
    '#07070C',
  );

  bg.addColorStop(
    0.5,
    '#10101B',
  );

  bg.addColorStop(
    1,
    '#090912',
  );

  ctx.fillStyle = bg;

  ctx.fillRect(
    0,
    0,
    width,
    height,
  );


  /* PURPLE GLOW LEFT */

  const leftGlow =
    ctx.createRadialGradient(
      120,
      110,
      0,
      120,
      110,
      350,
    );

  leftGlow.addColorStop(
    0,
    'rgba(146,73,255,.18)',
  );

  leftGlow.addColorStop(
    1,
    'rgba(146,73,255,0)',
  );

  ctx.fillStyle =
    leftGlow;

  ctx.fillRect(
    0,
    0,
    500,
    500,
  );


  /* PINK GLOW RIGHT */

  const rightGlow =
    ctx.createRadialGradient(
      width - 80,
      height * 0.35,
      0,
      width - 80,
      height * 0.35,
      360,
    );

  rightGlow.addColorStop(
    0,
    'rgba(205,76,207,.11)',
  );

  rightGlow.addColorStop(
    1,
    'rgba(205,76,207,0)',
  );

  ctx.fillStyle =
    rightGlow;

  ctx.fillRect(
    width - 500,
    0,
    500,
    height,
  );


  /* GRID */

  ctx.save();

  ctx.strokeStyle =
    'rgba(255,255,255,.018)';

  ctx.lineWidth = 1;

  for (
    let x = -height;
    x < width + height;
    x += 44
  ) {
    ctx.beginPath();

    ctx.moveTo(
      x,
      0,
    );

    ctx.lineTo(
      x + height,
      height,
    );

    ctx.stroke();
  }

  ctx.restore();


  /* DECORATIVE CIRCLES */

  ctx.save();

  ctx.strokeStyle =
    'rgba(184,126,255,.055)';

  ctx.lineWidth = 1;

  for (
    let r = 60;
    r <= 230;
    r += 42
  ) {
    ctx.beginPath();

    ctx.arc(
      width - 120,
      50,
      r,
      0,
      Math.PI * 2,
    );

    ctx.stroke();
  }

  ctx.restore();


  /* TOP ACCENT */

  const topAccent =
    ctx.createLinearGradient(
      0,
      0,
      width,
      0,
    );

  topAccent.addColorStop(
    0,
    C.purple,
  );

  topAccent.addColorStop(
    0.52,
    C.pink,
  );

  topAccent.addColorStop(
    1,
    '#7047FF',
  );

  ctx.fillStyle =
    topAccent;

  ctx.fillRect(
    0,
    0,
    width,
    4,
  );


  /* HEADER BADGE */

  round(
    ctx,
    32,
    27,
    Math.min(
      340,
      width - 64,
    ),
    38,
    10,
    'rgba(157,92,255,.10)',
    'rgba(176,119,255,.27)',
  );

  ctx.fillStyle =
    C.purple;

  ctx.fillRect(
    46,
    39,
    3,
    14,
  );

  text(
    ctx,
    label,
    60,
    53,
    13,
    C.purple2,
    true,
    290,
  );


  /* FOOTER BRANDING */

  text(
    ctx,
    '◆ WYMIAR ZERQONA',
    width - 34,
    height - 22,
    12,
    C.muted2,
    true,
    null,
    'right',
  );

  return {
    cv,
    ctx,
  };
}


/* ─────────────────────────────────────────────────────────────
   AVATAR
───────────────────────────────────────────────────────────── */

async function avatar(
  ctx,
  user,
  x,
  y,
  radius,
  options = {},
) {
  const {
    ring = C.purple,
    glow = true,
  } = options;

  ctx.save();

  if (glow) {
    ctx.shadowColor =
      'rgba(157,92,255,.65)';

    ctx.shadowBlur = 25;
  }

  ctx.beginPath();

  ctx.arc(
    x,
    y,
    radius + 6,
    0,
    Math.PI * 2,
  );

  const ringGradient =
    ctx.createLinearGradient(
      x - radius,
      y - radius,
      x + radius,
      y + radius,
    );

  ringGradient.addColorStop(
    0,
    ring,
  );

  ringGradient.addColorStop(
    1,
    C.pink,
  );

  ctx.fillStyle =
    ringGradient;

  ctx.fill();

  ctx.restore();


  ctx.save();

  ctx.beginPath();

  ctx.arc(
    x,
    y,
    radius,
    0,
    Math.PI * 2,
  );

  ctx.clip();


  /* FALLBACK */

  const fallback =
    ctx.createLinearGradient(
      x - radius,
      y - radius,
      x + radius,
      y + radius,
    );

  fallback.addColorStop(
    0,
    '#4B2D84',
  );

  fallback.addColorStop(
    1,
    '#AA4A9D',
  );

  ctx.fillStyle =
    fallback;

  ctx.fillRect(
    x - radius,
    y - radius,
    radius * 2,
    radius * 2,
  );


  let drawn = false;

  if (
    user?.avatarURL &&
    /^https:\/\/cdn\.discord(?:app)?\.com\//.test(
      user.avatarURL,
    )
  ) {
    try {
      const response =
        await fetch(
          user.avatarURL,
          {
            signal:
              AbortSignal.timeout(
                4500,
              ),
          },
        );

      if (response.ok) {
        const size =
          Number(
            response.headers.get(
              'content-length',
            ) || 0,
          );

        if (
          !size ||
          size < 5_000_000
        ) {
          const bytes =
            Buffer.from(
              await response.arrayBuffer(),
            );

          if (
            bytes.length <
            5_000_000
          ) {
            const image =
              await loadImage(
                bytes,
              );

            ctx.drawImage(
              image,
              x - radius,
              y - radius,
              radius * 2,
              radius * 2,
            );

            drawn = true;
          }
        }
      }
    } catch {
      // fallback remains
    }
  }

  if (!drawn) {
    const letter =
      (
        user?.name ||
        user?.username ||
        '?'
      )
        .slice(
          0,
          1,
        )
        .toUpperCase();

    text(
      ctx,
      letter,
      x,
      y + radius * 0.34,
      radius * 0.9,
      C.white,
      true,
      null,
      'center',
    );
  }

  ctx.restore();


  /* SMALL STATUS DOT */

  ctx.save();

  ctx.beginPath();

  ctx.arc(
    x + radius * 0.7,
    y + radius * 0.7,
    Math.max(
      6,
      radius * 0.12,
    ),
    0,
    Math.PI * 2,
  );

  ctx.fillStyle =
    C.lime;

  ctx.fill();

  ctx.lineWidth = 3;
  ctx.strokeStyle =
    C.bg;

  ctx.stroke();

  ctx.restore();
}


/* ─────────────────────────────────────────────────────────────
   METRIC CARD
───────────────────────────────────────────────────────────── */

function metric(
  ctx,
  x,
  y,
  width,
  label,
  value,
  accent = C.purple,
  subtitle = null,
) {
  shadowCard(
    ctx,
    x,
    y,
    width,
    111,
    17,
  );

  const glow =
    ctx.createLinearGradient(
      x,
      y,
      x + width,
      y,
    );

  glow.addColorStop(
    0,
    accent,
  );

  glow.addColorStop(
    1,
    'rgba(255,255,255,0)',
  );

  ctx.fillStyle = glow;

  ctx.fillRect(
    x + 17,
    y + 18,
    76,
    2,
  );

  text(
    ctx,
    label.toUpperCase(),
    x + 20,
    y + 42,
    11,
    C.muted,
    true,
    width - 40,
  );

  text(
    ctx,
    value,
    x + 20,
    y + 82,
    29,
    C.white,
    true,
    width - 40,
  );

  if (subtitle) {
    text(
      ctx,
      subtitle,
      x + width - 18,
      y + 40,
      10,
      accent,
      true,
      width / 2,
      'right',
    );
  }
}


/* ─────────────────────────────────────────────────────────────
   PROGRESS BAR
───────────────────────────────────────────────────────────── */

function progressBar(
  ctx,
  x,
  y,
  width,
  height,
  fraction,
  from = C.purple,
  to = C.pink,
) {
  const progress =
    Math.max(
      0,
      Math.min(
        1,
        Number(
          fraction || 0,
        ),
      ),
    );

  round(
    ctx,
    x,
    y,
    width,
    height,
    height / 2,
    'rgba(255,255,255,.07)',
    'rgba(255,255,255,.04)',
  );

  if (
    progress <= 0
  ) {
    return;
  }

  const valueWidth =
    Math.max(
      height,
      width * progress,
    );

  const gradient =
    ctx.createLinearGradient(
      x,
      0,
      x + width,
      0,
    );

  gradient.addColorStop(
    0,
    from,
  );

  gradient.addColorStop(
    1,
    to,
  );

  ctx.save();

  ctx.shadowColor =
    from;

  ctx.shadowBlur = 12;

  round(
    ctx,
    x,
    y,
    valueWidth,
    height,
    height / 2,
    gradient,
  );

  ctx.restore();
}


/* ─────────────────────────────────────────────────────────────
   PROFILE CARD
───────────────────────────────────────────────────────────── */

export async function profileCard(
  user,
  row,
  rank,
  roleName = 'Wędrowiec',
) {
  const {
    cv,
    ctx,
  } = base(
    1080,
    520,
    'PROFIL / KARTA UŻYTKOWNIKA',
  );

  const progress =
    progressForXp(
      row.xp,
    );


  /* USER SECTION */

  shadowCard(
    ctx,
    32,
    88,
    1016,
    190,
    22,
    'rgba(16,16,27,.78)',
  );

  await avatar(
    ctx,
    user,
    134,
    182,
    67,
  );

  text(
    ctx,
    user.name,
    230,
    146,
    34,
    C.white,
    true,
    530,
  );

  text(
    ctx,
    `@${user.username || user.name}`,
    232,
    178,
    15,
    C.muted,
    false,
    500,
  );


  /* ROLE */

  const roleWidth =
    Math.min(
      330,
      Math.max(
        175,
        roleName.length * 11 + 54,
      ),
    );

  round(
    ctx,
    230,
    199,
    roleWidth,
    36,
    10,
    'rgba(157,92,255,.12)',
    'rgba(174,117,255,.27)',
  );

  text(
    ctx,
    `◆ ${roleName.toUpperCase()}`,
    248,
    223,
    13,
    C.purple2,
    true,
    roleWidth - 34,
  );


  /* RANK */

  text(
    ctx,
    'RANKING SERWERA',
    1004,
    130,
    11,
    C.muted,
    true,
    null,
    'right',
  );

  text(
    ctx,
    `#${fmt(rank)}`,
    1004,
    174,
    34,
    C.lime,
    true,
    null,
    'right',
  );


  /* TITLE */

  if (row.title) {
    text(
      ctx,
      `✦ ${row.title}`,
      1004,
      218,
      15,
      C.pink,
      true,
      380,
      'right',
    );
  }


  /* XP */

  text(
    ctx,
    `POZIOM ${String(progress.level).padStart(2, '0')}`,
    231,
    259,
    11,
    C.muted,
    true,
  );

  text(
    ctx,
    `${fmt(progress.current)} / ${fmt(progress.required)} XP`,
    1004,
    259,
    11,
    C.muted,
    true,
    null,
    'right',
  );

  progressBar(
    ctx,
    231,
    267,
    773,
    11,
    progress.fraction,
  );


  /* METRICS */

  metric(
    ctx,
    32,
    306,
    324,
    'Poziom',
    String(
      progress.level,
    ).padStart(
      2,
      '0',
    ),
    C.purple,
  );

  metric(
    ctx,
    378,
    306,
    324,
    'Ranking',
    `#${fmt(rank)}`,
    C.lime,
  );

  metric(
    ctx,
    724,
    306,
    324,
    'Monety',
    `${fmt(row.balance)} ◈`,
    C.pink,
  );


  /* ACTIVITY */

  divider(
    ctx,
    32,
    445,
    1016,
  );

  text(
    ctx,
    'AKTYWNOŚĆ',
    34,
    474,
    10,
    C.muted2,
    true,
  );

  text(
    ctx,
    `WIADOMOŚCI  ${fmt(row.messages)}`,
    135,
    474,
    12,
    C.softWhite,
    true,
  );

  text(
    ctx,
    `VC  ${Math.floor(Number(row.voice_seconds || 0) / 3600)} H`,
    340,
    474,
    12,
    C.softWhite,
    true,
  );

  text(
    ctx,
    `${fmt(row.xp)} XP ŁĄCZNIE`,
    1004,
    474,
    12,
    C.muted,
    true,
    null,
    'right',
  );

  return cv.toBuffer(
    'image/png',
  );
}


/* ─────────────────────────────────────────────────────────────
   RANK CARD
───────────────────────────────────────────────────────────── */

export async function rankCard(
  user,
  row,
  rank,
) {
  const {
    cv,
    ctx,
  } = base(
    1080,
    420,
    'RANKING / POSTĘP',
  );

  const progress =
    progressForXp(
      row.xp,
    );


  shadowCard(
    ctx,
    32,
    92,
    1016,
    244,
    22,
  );

  await avatar(
    ctx,
    user,
    126,
    193,
    65,
  );

  text(
    ctx,
    user.name,
    222,
    146,
    32,
    C.white,
    true,
    490,
  );

  text(
    ctx,
    `@${user.username || user.name}`,
    224,
    178,
    14,
    C.muted,
    false,
    480,
  );

  text(
    ctx,
    `LV ${String(progress.level).padStart(2, '0')}`,
    224,
    226,
    30,
    C.lime,
    true,
  );


  /* RANK BADGE */

  round(
    ctx,
    830,
    126,
    170,
    84,
    16,
    'rgba(157,92,255,.10)',
    'rgba(157,92,255,.25)',
  );

  text(
    ctx,
    'MIEJSCE',
    915,
    156,
    10,
    C.muted,
    true,
    null,
    'center',
  );

  text(
    ctx,
    `#${fmt(rank)}`,
    915,
    194,
    29,
    C.purple2,
    true,
    null,
    'center',
  );


  /* XP */

  text(
    ctx,
    'POSTĘP DO KOLEJNEGO POZIOMU',
    224,
    271,
    11,
    C.muted,
    true,
  );

  text(
    ctx,
    `${Math.round(progress.fraction * 100)}%`,
    999,
    271,
    11,
    C.purple2,
    true,
    null,
    'right',
  );

  progressBar(
    ctx,
    224,
    286,
    775,
    18,
    progress.fraction,
    C.purple,
    C.lime,
  );

  text(
    ctx,
    `${fmt(progress.current)} / ${fmt(progress.required)} XP`,
    224,
    327,
    13,
    C.softWhite,
    true,
  );


  text(
    ctx,
    `${fmt(row.xp)} XP ŁĄCZNIE`,
    999,
    327,
    13,
    C.muted,
    true,
    null,
    'right',
  );


  glowLine(
    ctx,
    275,
    369,
    530,
  );

  return cv.toBuffer(
    'image/png',
  );
}


/* ─────────────────────────────────────────────────────────────
   ECONOMY CARD
───────────────────────────────────────────────────────────── */

export async function economyCard(
  user,
  row,
  rank,
  inventory = [],
) {
  const {
    cv,
    ctx,
  } = base(
    1080,
    500,
    'EKONOMIA / PORTFEL',
  );

  const inventoryCount =
    inventory.reduce(
      (
        total,
        item,
      ) =>
        total +
        Number(
          item.quantity || 0,
        ),
      0,
    );


  shadowCard(
    ctx,
    32,
    94,
    1016,
    148,
    22,
  );

  await avatar(
    ctx,
    user,
    116,
    169,
    53,
  );

  text(
    ctx,
    user.name,
    195,
    145,
    29,
    C.white,
    true,
    480,
  );

  text(
    ctx,
    'SKARBIEC UŻYTKOWNIKA',
    196,
    179,
    12,
    C.purple2,
    true,
  );

  text(
    ctx,
    `#${fmt(rank)}`,
    1000,
    152,
    31,
    C.pink,
    true,
    null,
    'right',
  );

  text(
    ctx,
    'RANKING EKONOMII',
    1000,
    180,
    10,
    C.muted,
    true,
    null,
    'right',
  );


  /* BALANCE */

  shadowCard(
    ctx,
    32,
    270,
    655,
    160,
    22,
    'rgba(20,19,33,.94)',
  );

  text(
    ctx,
    'SALDO KONTA',
    60,
    309,
    12,
    C.muted,
    true,
  );

  text(
    ctx,
    `${fmt(row.balance)} ◈`,
    58,
    380,
    48,
    C.lime,
    true,
    590,
  );

  glowLine(
    ctx,
    60,
    404,
    355,
    C.lime,
  );


  /* SIDE CARD */

  shadowCard(
    ctx,
    711,
    270,
    337,
    160,
    22,
  );

  text(
    ctx,
    'PLECAK',
    738,
    308,
    11,
    C.muted,
    true,
  );

  text(
    ctx,
    fmt(
      inventoryCount,
    ),
    738,
    359,
    35,
    C.white,
    true,
  );

  text(
    ctx,
    inventoryCount === 1
      ? 'PRZEDMIOT'
      : 'PRZEDMIOTÓW',
    738,
    389,
    11,
    C.purple2,
    true,
  );

  text(
    ctx,
    `#${fmt(rank)}`,
    1019,
    360,
    27,
    C.pink,
    true,
    null,
    'right',
  );

  text(
    ctx,
    'POZYCJA',
    1019,
    389,
    10,
    C.muted,
    true,
    null,
    'right',
  );


  /* COMMAND FOOTER */

  text(
    ctx,
    '/daily',
    34,
    465,
    12,
    C.purple2,
    true,
  );

  text(
    ctx,
    '/praca',
    112,
    465,
    12,
    C.softWhite,
    true,
  );

  text(
    ctx,
    '/sklep',
    194,
    465,
    12,
    C.softWhite,
    true,
  );

  text(
    ctx,
    '/przelew',
    276,
    465,
    12,
    C.softWhite,
    true,
  );

  return cv.toBuffer(
    'image/png',
  );
}


/* ─────────────────────────────────────────────────────────────
   TOP CARD
───────────────────────────────────────────────────────────── */

export async function topCard(
  rows,
  users,
  kind = 'xp',
) {
  const rowHeight = 72;

  const height =
    188 +
    rows.length * rowHeight;

  const {
    cv,
    ctx,
  } = base(
    1080,
    height,
    kind === 'xp'
      ? 'RANKING / DOŚWIADCZENIE'
      : 'RANKING / EKONOMIA',
  );

  text(
    ctx,
    kind === 'xp'
      ? 'TABLICA DOŚWIADCZENIA'
      : 'TABLICA BOGACTWA',
    38,
    116,
    29,
    C.white,
    true,
  );

  text(
    ctx,
    kind === 'xp'
      ? 'Najaktywniejsi użytkownicy Wymiaru Zerqona'
      : 'Najbogatsi użytkownicy Wymiaru Zerqona',
    39,
    144,
    13,
    C.muted,
    false,
  );


  for (
    let i = 0;
    i < rows.length;
    i++
  ) {
    const row =
      rows[i];

    const usr =
      users[i] || {
        name:
          `Użytkownik ${row.user_id.slice(-5)}`,
      };

    const y =
      166 +
      i * rowHeight;

    const podium =
      i < 3;

    const rankColor =
      i === 0
        ? C.gold
        : i === 1
          ? C.silver
          : i === 2
            ? C.bronze
            : C.purple2;

    shadowCard(
      ctx,
      35,
      y,
      1010,
      60,
      14,
      podium
        ? 'rgba(31,28,45,.96)'
        : 'rgba(18,18,29,.93)',
      podium
        ? 'rgba(157,92,255,.27)'
        : C.border,
    );


    /* PODIUM ACCENT */

    ctx.fillStyle =
      rankColor;

    ctx.fillRect(
      35,
      y + 13,
      3,
      34,
    );


    text(
      ctx,
      `#${String(i + 1).padStart(2, '0')}`,
      60,
      y + 39,
      19,
      rankColor,
      true,
    );


    await avatar(
      ctx,
      usr,
      157,
      y + 30,
      19,
      {
        ring:
          podium
            ? rankColor
            : C.purple,
        glow: false,
      },
    );


    text(
      ctx,
      usr.name,
      198,
      y + 37,
      17,
      C.white,
      true,
      450,
    );


    if (
      kind === 'xp'
    ) {
      text(
        ctx,
        `LV ${levelForXp(row.xp)}`,
        725,
        y + 37,
        15,
        C.purple2,
        true,
      );

      text(
        ctx,
        `${fmt(row.xp)} XP`,
        1016,
        y + 37,
        16,
        C.lime,
        true,
        null,
        'right',
      );
    } else {
      text(
        ctx,
        `${fmt(row.balance)} ◈`,
        1016,
        y + 37,
        17,
        C.lime,
        true,
        null,
        'right',
      );
    }
  }

  return cv.toBuffer(
    'image/png',
  );
}


/* ─────────────────────────────────────────────────────────────
   WELCOME CARD
───────────────────────────────────────────────────────────── */

export async function welcomeCard(
  user,
  memberCount,
) {
  const {
    cv,
    ctx,
  } = base(
    1080,
    430,
    'NOWY UŻYTKOWNIK / WITAJ',
  );


  /* MAIN PANEL */

  shadowCard(
    ctx,
    32,
    92,
    1016,
    267,
    24,
    'rgba(15,15,25,.84)',
  );


  /* AVATAR */

  await avatar(
    ctx,
    user,
    164,
    223,
    82,
  );


  /* CONTENT */

  text(
    ctx,
    'WITAJ W WYMIARZE ZERQONA',
    290,
    151,
    16,
    C.purple2,
    true,
  );

  text(
    ctx,
    user.name,
    290,
    210,
    38,
    C.white,
    true,
    690,
  );

  text(
    ctx,
    `Jesteś osobą numer #${fmt(memberCount)} na serwerze.`,
    291,
    251,
    16,
    C.muted,
    false,
    680,
  );


  /* WELCOME TAGS */

  round(
    ctx,
    290,
    286,
    142,
    34,
    10,
    'rgba(157,92,255,.10)',
    'rgba(157,92,255,.24)',
  );

  text(
    ctx,
    '◆ ZBIERAJ XP',
    306,
    309,
    11,
    C.purple2,
    true,
  );


  round(
    ctx,
    444,
    286,
    150,
    34,
    10,
    'rgba(191,255,105,.07)',
    'rgba(191,255,105,.18)',
  );

  text(
    ctx,
    '◆ BĄDŹ AKTYWNY',
    460,
    309,
    11,
    C.lime,
    true,
  );


  round(
    ctx,
    606,
    286,
    170,
    34,
    10,
    'rgba(235,106,214,.07)',
    'rgba(235,106,214,.18)',
  );

  text(
    ctx,
    '◆ BUDUJ LEGENDĘ',
    622,
    309,
    11,
    C.pink,
    true,
  );


  glowLine(
    ctx,
    295,
    346,
    570,
  );

  return cv.toBuffer(
    'image/png',
  );
}



/* ─────────────────────────────────────────────────────────────
   SHOP CARD
───────────────────────────────────────────────────────────── */

export async function shopCard(
  shopItems,
  balance = 0,
) {
  const entries = Object.entries(
    shopItems || {},
  );

  const columns = 2;
  const cardWidth = 497;
  const cardHeight = 190;
  const gapX = 16;
  const gapY = 16;

  const rows = Math.max(
    1,
    Math.ceil(entries.length / columns),
  );

  const startY = 275;

  const height =
    startY +
    rows * (cardHeight + gapY) +
    80;

  const {
    cv,
    ctx,
  } = base(
    1080,
    height,
    'SKLEP / WYMIAR ZERQONA',
  );


  /* ─────────────────────────────────────────────────────────
     HEADER
  ───────────────────────────────────────────────────────── */

  text(
    ctx,
    'SKLEP WYMIARU ZERQONA',
    38,
    112,
    30,
    C.white,
    true,
  );

  text(
    ctx,
    'Boosty, tytuły i przedmioty kosmetyczne dla Twojego profilu.',
    39,
    142,
    13,
    C.muted,
    false,
    630,
  );


  /* BALANCE */

  shadowCard(
    ctx,
    756,
    88,
    289,
    91,
    18,
    'rgba(17,17,29,.95)',
    'rgba(191,255,105,.15)',
  );

  text(
    ctx,
    'TWOJE SALDO',
    780,
    118,
    10,
    C.muted,
    true,
  );

  text(
    ctx,
    `${fmt(balance)} ◈`,
    780,
    157,
    27,
    C.lime,
    true,
    238,
  );


  /* ─────────────────────────────────────────────────────────
     SHOP SUMMARY
  ───────────────────────────────────────────────────────── */

  const boostCount = entries.filter(
    ([, item]) =>
      item.category === 'boost' ||
      item.type === 'consumable',
  ).length;

  const titleCount = entries.filter(
    ([, item]) =>
      item.category === 'title' ||
      item.type === 'title',
  ).length;

  shadowCard(
    ctx,
    35,
    183,
    1010,
    68,
    16,
    'rgba(15,15,25,.82)',
  );

  text(
    ctx,
    'KATALOG',
    57,
    211,
    9,
    C.muted,
    true,
  );

  text(
    ctx,
    `${entries.length} PRZEDMIOTÓW`,
    57,
    235,
    14,
    C.white,
    true,
  );

  line(
    ctx,
    220,
    199,
    220,
    236,
    'rgba(255,255,255,.08)',
  );

  text(
    ctx,
    'BOOSTY',
    248,
    211,
    9,
    C.muted,
    true,
  );

  text(
    ctx,
    `${boostCount}`,
    248,
    235,
    14,
    C.purple2,
    true,
  );

  line(
    ctx,
    360,
    199,
    360,
    236,
    'rgba(255,255,255,.08)',
  );

  text(
    ctx,
    'TYTUŁY',
    388,
    211,
    9,
    C.muted,
    true,
  );

  text(
    ctx,
    `${titleCount}`,
    388,
    235,
    14,
    C.pink,
    true,
  );

  text(
    ctx,
    '/kup  •  /plecak  •  /uzyj',
    1018,
    226,
    11,
    C.muted,
    true,
    null,
    'right',
  );


  /* ─────────────────────────────────────────────────────────
     ITEM CARDS
  ───────────────────────────────────────────────────────── */

  const rarityMap = {
    common: {
      name: 'COMMON',
      color: '#A7A7B6',
    },
    rare: {
      name: 'RARE',
      color: '#6EA8FF',
    },
    epic: {
      name: 'EPIC',
      color: '#B56CFF',
    },
    legendary: {
      name: 'LEGENDARY',
      color: '#FFB74D',
    },
    mythic: {
      name: 'MYTHIC',
      color: '#FF6ACD',
    },
  };

  for (
    let index = 0;
    index < entries.length;
    index++
  ) {
    const [
      id,
      item,
    ] = entries[index];

    const column = index % columns;
    const rowIndex = Math.floor(index / columns);

    const x =
      35 +
      column * (cardWidth + gapX);

    const y =
      startY +
      rowIndex * (cardHeight + gapY);

    const rarity = String(
      item.rarity ||
      (item.type === 'consumable' ? 'rare' : 'epic'),
    ).toLowerCase();

    const rarityInfo =
      rarityMap[rarity] ||
      rarityMap.epic;

    const accent =
      rarityInfo.color;

    const isBoost =
      item.category === 'boost' ||
      item.type === 'consumable';

    const typeLabel =
      isBoost
        ? 'BOOST'
        : 'TYTUŁ';

    const displayName =
      item.shortName ||
      item.name ||
      id;

    const effect =
      item.effect ||
      item.effectLabel ||
      (isBoost
        ? 'Bonus czasowy'
        : 'Tytuł profilu');

    const duration =
      item.duration ||
      item.durationLabel ||
      (isBoost
        ? 'Jednorazowy'
        : 'Na stałe');

    const details = Array.isArray(item.details)
      ? item.details
      : [];


    /* CARD */

    shadowCard(
      ctx,
      x,
      y,
      cardWidth,
      cardHeight,
      18,
      'rgba(16,16,27,.95)',
      rarity === 'mythic'
        ? 'rgba(255,106,205,.30)'
        : rarity === 'legendary'
          ? 'rgba(255,183,77,.25)'
          : rarity === 'epic'
            ? 'rgba(181,108,255,.22)'
            : rarity === 'rare'
              ? 'rgba(110,168,255,.20)'
              : C.border,
    );


    /* RARITY STRIP */

    const strip =
      ctx.createLinearGradient(
        x,
        y,
        x,
        y + cardHeight,
      );

    strip.addColorStop(
      0,
      accent,
    );

    strip.addColorStop(
      1,
      'rgba(255,255,255,0)',
    );

    ctx.fillStyle = strip;

    ctx.fillRect(
      x,
      y + 18,
      3,
      cardHeight - 36,
    );


    /* ICON */

    round(
      ctx,
      x + 20,
      y + 21,
      59,
      59,
      16,
      'rgba(255,255,255,.035)',
      'rgba(255,255,255,.075)',
    );

    text(
      ctx,
      item.icon || (isBoost ? '✦' : '◆'),
      x + 49,
      y + 61,
      25,
      accent,
      true,
      null,
      'center',
    );


    /* NAME + RARITY */

    text(
      ctx,
      displayName,
      x + 96,
      y + 39,
      16,
      C.white,
      true,
      250,
    );

    text(
      ctx,
      rarityInfo.name,
      x + 96,
      y + 61,
      9,
      accent,
      true,
    );


    /* PRICE */

    text(
      ctx,
      `${fmt(item.price)} ◈`,
      x + cardWidth - 19,
      y + 39,
      16,
      C.lime,
      true,
      125,
      'right',
    );


    /* TAGS */

    round(
      ctx,
      x + 96,
      y + 72,
      70,
      24,
      7,
      'rgba(157,92,255,.08)',
      'rgba(157,92,255,.18)',
    );

    text(
      ctx,
      typeLabel,
      x + 131,
      y + 88,
      8,
      C.purple2,
      true,
      null,
      'center',
    );

    round(
      ctx,
      x + 174,
      y + 72,
      Math.min(
        176,
        Math.max(92, effect.length * 6.2),
      ),
      24,
      7,
      'rgba(255,255,255,.035)',
      'rgba(255,255,255,.07)',
    );

    text(
      ctx,
      effect,
      x + 185,
      y + 88,
      8,
      C.softWhite,
      true,
      154,
    );


    /* DESCRIPTION */

    wrapText(
      ctx,
      item.description || 'Przedmiot dostępny w sklepie.',
      x + 20,
      y + 119,
      cardWidth - 40,
      15,
      2,
      10,
      C.muted,
      false,
    );


    /* DETAILS */

    if (details.length) {
      const detailText =
        details
          .slice(0, 2)
          .map((value) => `◆ ${value}`)
          .join('   ');

      text(
        ctx,
        detailText,
        x + 20,
        y + 157,
        8,
        C.muted2,
        false,
        cardWidth - 40,
      );
    }


    /* FOOTER */

    divider(
      ctx,
      x + 20,
      y + 166,
      cardWidth - 40,
    );

    text(
      ctx,
      `ID: ${id}`,
      x + 20,
      y + 183,
      8,
      C.muted2,
      false,
      235,
    );

    text(
      ctx,
      duration,
      x + cardWidth - 20,
      y + 183,
      8,
      accent,
      true,
      190,
      'right',
    );
  }


  /* EMPTY SHOP */

  if (!entries.length) {
    shadowCard(
      ctx,
      35,
      startY,
      1010,
      150,
      20,
    );

    text(
      ctx,
      'BRAK PRZEDMIOTÓW',
      540,
      startY + 65,
      22,
      C.white,
      true,
      null,
      'center',
    );

    text(
      ctx,
      'Katalog sklepu jest obecnie pusty.',
      540,
      startY + 95,
      12,
      C.muted,
      false,
      null,
      'center',
    );
  }


  /* ─────────────────────────────────────────────────────────
     FOOTER
  ───────────────────────────────────────────────────────── */

  const footerY = height - 42;

  divider(
    ctx,
    35,
    footerY - 27,
    1010,
  );

  text(
    ctx,
    '/kup',
    36,
    footerY,
    11,
    C.purple2,
    true,
  );

  text(
    ctx,
    'KUP PRZEDMIOT',
    82,
    footerY,
    9,
    C.muted,
    true,
  );

  text(
    ctx,
    '/plecak',
    220,
    footerY,
    11,
    C.purple2,
    true,
  );

  text(
    ctx,
    'TWÓJ EKWIPUNEK',
    288,
    footerY,
    9,
    C.muted,
    true,
  );

  text(
    ctx,
    '/uzyj',
    451,
    footerY,
    11,
    C.purple2,
    true,
  );

  text(
    ctx,
    'AKTYWUJ PRZEDMIOT',
    504,
    footerY,
    9,
    C.muted,
    true,
  );

  text(
    ctx,
    'WYMIAR ZERQONA • MARKET',
    1027,
    footerY,
    9,
    C.muted2,
    true,
    null,
    'right',
  );

  return cv.toBuffer(
    'image/png',
  );
}


/* ─────────────────────────────────────────────────────────────
   USER NORMALIZER
───────────────────────────────────────────────────────────── */

export const userForCard =
  (member) => ({
    name:
      member.displayName ||
      member.globalName ||
      member.username,

    username:
      member.user?.username ||
      member.username,

    avatarURL:
      member.displayAvatarURL?.({
        extension: 'png',
        size: 256,
      }) ||
      member.user?.displayAvatarURL?.({
        extension: 'png',
        size: 256,
      }),
  });
