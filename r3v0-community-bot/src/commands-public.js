import crypto from 'node:crypto';
import {
  AttachmentBuilder,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';

import { config } from './config.js';
import {
  profileCard,
  rankCard,
  economyCard,
  topCard,
  userForCard,
} from './cards.js';
import { items } from './shop.js';
import { levelForXp } from './level.js';
import { showRoomPanel } from './voice.js';


/* ─────────────────────────────────────────────────────────────
   WYMIAR ZERQONA — PUBLIC COMMAND HANDLER
───────────────────────────────────────────────────────────── */

const COLORS = {
  PRIMARY: 0xA76CFF,
  ECONOMY: 0xC5FF60,
};

const fmt = (number) =>
  new Intl.NumberFormat('pl-PL').format(number);

const stamp = (date) =>
  `<t:${Math.floor(date / 1000)}:F>`;

const say = (interaction, content, privateReply = false) =>
  interaction.reply({
    content,
    ...(privateReply
      ? { flags: MessageFlags.Ephemeral }
      : {}),
    allowedMentions: {
      parse: [],
    },
  });

const phrases = [
  'Zdecydowanie tak.',
  'Jeszcze nie teraz.',
  'Nie licz na to.',
  'Wygląda obiecująco.',
  'Zapytaj ponownie później.',
  'Gwiazdy mówią: tak!',
  'To ryzykowny pomysł.',
  'Bez wątpienia.',
];


/* ─────────────────────────────────────────────────────────────
   TARGET
───────────────────────────────────────────────────────────── */

async function target(interaction) {
  const user =
    interaction.options.getUser('osoba') ||
    interaction.user;

  const member = await interaction.guild.members
    .fetch(user.id)
    .catch(() => null);

  return {
    user,
    member,
    display: userForCard(member || user),
  };
}


/* ─────────────────────────────────────────────────────────────
   PUBLIC COMMANDS
───────────────────────────────────────────────────────────── */

export async function handlePublic(i, store) {
  const guild = i.guildId;
  const name = i.commandName;


  /* ═══════════════════════════════════════════════════════════
     /POMOC
  ═══════════════════════════════════════════════════════════ */

  if (name === 'pomoc') {
    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('✦ WYMIAR ZERQONA · CENTRUM KOMEND')
      .setDescription(
        [
          '**Witaj w centrum komend serwera Wymiar ZERQONA.**',
          '',
          'Zdobywaj XP za aktywność tekstową i głosową, rozwijaj swój profil, zarabiaj monety, korzystaj ze sklepu i twórz własne pokoje głosowe.',
        ].join('\n'),
      )
      .addFields(
        {
          name: '◆ PROFIL I POZIOMY',
          value:
            '`/profil` — karta twojego profilu\n' +
            '`/ranga` — poziom, XP i pozycja w rankingu\n' +
            '`/top` — ranking serwera\n' +
            '`/userinfo` — informacje o użytkowniku\n' +
            '`/serverinfo` — informacje o serwerze',
        },
        {
          name: '◈ EKONOMIA',
          value:
            '`/portfel` — stan konta i ekonomia\n' +
            '`/daily` — codzienna nagroda\n' +
            '`/praca` — dodatkowy zarobek\n' +
            '`/przelew` — przelej monety użytkownikowi\n' +
            '`/sklep` — dostępne przedmioty\n' +
            '`/kup` — kup przedmiot\n' +
            '`/plecak` — twoje przedmioty\n' +
            '`/uzyj` — użyj przedmiotu',
        },
        {
          name: '✦ ROZRYWKA',
          value:
            '`/moneta` — orzeł czy reszka\n' +
            '`/sloty` — automat hazardowy\n' +
            '`/kostka` — rzut kostką\n' +
            '`/wrozba` — zapytaj magicznej kuli\n' +
            '`/kpn` — kamień, papier, nożyce\n' +
            '`/ankieta` — utwórz ankietę',
        },
        {
          name: '◉ PRYWATNY POKÓJ GŁOSOWY',
          value:
            `Wejdź na <#${config.channels.voiceLobby}> — bot automatycznie utworzy dla ciebie prywatny kanał głosowy.\n\n` +
            'Panelem możesz zarządzać bezpośrednio na swoim kanale lub używając `/pokoj`.',
        },
        {
          name: '⚙ KOMENDY EKIPY',
          value:
            '**Helper**\n' +
            '`/warn` `/unwarn` `/wyczysc`\n\n' +

            '**Moderator**\n' +
            '`/mute` `/unmute` `/timeout` `/untimeout`\n' +
            '`/kick` `/ban` `/unban`\n' +
            '`/slowmode` `/zamknij` `/otworz`\n\n' +

            '**Szef**\n' +
            '`/rola` `/xp` `/monety_admin`',
        },
      )
      .setFooter({
        text: 'Wymiar ZERQONA • Booster serwera otrzymuje 2× XP • Prywatny pokój znika po opróżnieniu',
      });

    await i.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });

    return true;
  }


  /* ═══════════════════════════════════════════════════════════
     /PING
  ═══════════════════════════════════════════════════════════ */

  if (name === 'ping') {
    await say(
      i,
      `🏓 **Pong!** Opóźnienie WebSocket wynosi **${i.client.ws.ping} ms**.`,
    );

    return true;
  }


  /* ═══════════════════════════════════════════════════════════
     /POKOJ
  ═══════════════════════════════════════════════════════════ */

  if (name === 'pokoj') {
    await showRoomPanel(i, store);
    return true;
  }


  /* ═══════════════════════════════════════════════════════════
     /PROFIL
     /RANGA
     /PORTFEL
  ═══════════════════════════════════════════════════════════ */

  if (['profil', 'ranga', 'portfel'].includes(name)) {
    await i.deferReply();

    const {
      user,
      member,
      display,
    } = await target(i);

    const row = store.user(
      guild,
      user.id,
    );

    const field =
      name === 'portfel'
        ? 'balance'
        : 'xp';

    const rank = store.rank(
      guild,
      user.id,
      field,
    );

    const role =
      [...config.levelRoles]
        .reverse()
        .find(
          (r) =>
            levelForXp(row.xp) >= r.level,
        )?.name || 'Początkujący';

    const image =
      name === 'profil'
        ? await profileCard(
            display,
            row,
            rank,
            role,
          )
        : name === 'ranga'
          ? await rankCard(
              display,
              row,
              rank,
            )
          : await economyCard(
              display,
              row,
              rank,
              store.inventory(
                guild,
                user.id,
              ),
            );

    await i.editReply({
      files: [
        new AttachmentBuilder(
          image,
          {
            name: `${name}-${user.id}.png`,
          },
        ),
      ],
    });

    return true;
  }


  /* ═══════════════════════════════════════════════════════════
     /TOP
  ═══════════════════════════════════════════════════════════ */

  if (name === 'top') {
    await i.deferReply();

    const kind =
      i.options.getString('typ') ||
      'xp';

    const rows = store.top(
      guild,
      kind,
      10,
    );

    if (!rows.length) {
      await i.editReply(
        '✦ Ranking jest obecnie pusty. Zdobądź pierwsze XP lub monety, aby się w nim pojawić.',
      );

      return true;
    }

    const users = await Promise.all(
      rows.map(async (row) => {
        const member =
          await i.guild.members
            .fetch(row.user_id)
            .catch(() => null);

        if (member) {
          return userForCard(member);
        }

        const user =
          await i.client.users
            .fetch(row.user_id)
            .catch(() => null);

        return user
          ? userForCard(user)
          : {
              name: `Gracz ${row.user_id.slice(-5)}`,
            };
      }),
    );

    const image = await topCard(
      rows,
      users,
      kind,
    );

    await i.editReply({
      files: [
        new AttachmentBuilder(
          image,
          {
            name: `top-${kind}.png`,
          },
        ),
      ],
    });

    return true;
  }


  /* ═══════════════════════════════════════════════════════════
     /DAILY
     /PRACA
  ═══════════════════════════════════════════════════════════ */

  if (
    name === 'daily' ||
    name === 'praca'
  ) {
    const isDaily =
      name === 'daily';

    const reward =
      isDaily
        ? 350
        : crypto.randomInt(
            100,
            241,
          );

    const result =
      store.claim(
        guild,
        i.user.id,
        isDaily
          ? 'daily'
          : 'work',
        isDaily
          ? 24 * 3600000
          : 45 * 60000,
        reward,
      );

    if (!result.ok) {
      await say(
        i,
        `⏳ Ta nagroda nie jest jeszcze dostępna.\nMożesz odebrać ją ponownie <t:${Math.floor(result.availableAt / 1000)}:R>.`,
        true,
      );

      return true;
    }

    await say(
      i,
      `◈ Otrzymujesz **${fmt(reward)} monet**!\nTwój aktualny stan konta: **${fmt(result.balance)} ◈**.`,
    );

    return true;
  }


  /* ═══════════════════════════════════════════════════════════
     /PRZELEW
  ═══════════════════════════════════════════════════════════ */

  if (name === 'przelew') {
    const user =
      i.options.getUser(
        'osoba',
        true,
      );

    const amount =
      i.options.getInteger(
        'ilosc',
        true,
      );

    if (
      user.bot ||
      user.id === i.user.id
    ) {
      await say(
        i,
        '✦ Wybierz innego użytkownika. Nie możesz wysłać przelewu do siebie ani do bota.',
        true,
      );

      return true;
    }

    const ok =
      store.transfer(
        guild,
        i.user.id,
        user.id,
        amount,
      );

    await say(
      i,
      ok
        ? `◈ Przelano **${fmt(amount)} monet** użytkownikowi <@${user.id}>.`
        : '✦ Nie masz wystarczającej liczby monet, aby wykonać ten przelew.',
      !ok,
    );

    return true;
  }


  /* ═══════════════════════════════════════════════════════════
     /SKLEP
  ═══════════════════════════════════════════════════════════ */

  if (name === 'sklep') {
    const embed =
      new EmbedBuilder()
        .setColor(
          COLORS.ECONOMY,
        )
        .setTitle(
          '◈ WYMIAR ZERQONA · SKLEP',
        )
        .setDescription(
          [
            'Kupuj ulepszenia i dodatkowe przedmioty za zdobyte monety.',
            '',
            'Użyj `/kup`, aby kupić przedmiot.',
            'Użyj `/plecak`, aby sprawdzić ekwipunek.',
            'Użyj `/uzyj`, aby aktywować posiadany przedmiot.',
          ].join('\n'),
        )
        .addFields(
          Object.entries(
            items,
          ).map(
            ([id, item]) => ({
              name:
                `${item.name} · ${fmt(item.price)} ◈`,
              value:
                `${item.description}\n` +
                `> ID przedmiotu: \`${id}\``,
              inline: false,
            }),
          ),
        )
        .setFooter({
          text: 'Wymiar ZERQONA • Ekonomia serwera',
        });

    await i.reply({
      embeds: [embed],
    });

    return true;
  }


  /* ═══════════════════════════════════════════════════════════
     /KUP
  ═══════════════════════════════════════════════════════════ */

  if (name === 'kup') {
    const id =
      i.options.getString(
        'przedmiot',
        true,
      );

    const ok =
      store.buy(
        guild,
        i.user.id,
        id,
      );

    await say(
      i,
      ok
        ? `🛍️ Kupiono **${items[id].name}** za **${fmt(items[id].price)} ◈**.\nPrzedmiot znajdziesz w \`/plecak\`. Możesz go aktywować przez \`/uzyj\`.`
        : '✦ Nie masz wystarczającej liczby monet na zakup tego przedmiotu.',
      !ok,
    );

    return true;
  }


  /* ═══════════════════════════════════════════════════════════
     /PLECAK
  ═══════════════════════════════════════════════════════════ */

  if (name === 'plecak') {
    const inventory =
      store.inventory(
        guild,
        i.user.id,
      );

    const desc =
      inventory.length
        ? inventory
            .map(
              (row) =>
                `◆ **${items[row.item_id]?.name || row.item_id}** ×${row.quantity}`,
            )
            .join('\n')
        : 'Twój plecak jest obecnie pusty.\n\nZajrzyj do `/sklep`, aby kupić pierwszy przedmiot.';

    const embed =
      new EmbedBuilder()
        .setColor(
          COLORS.PRIMARY,
        )
        .setTitle(
          `🎒 Plecak · ${i.user.username}`,
        )
        .setDescription(desc)
        .setFooter({
          text: 'Wymiar ZERQONA • Twój ekwipunek',
        });

    await i.reply({
      embeds: [embed],
      flags:
        MessageFlags.Ephemeral,
    });

    return true;
  }


  /* ═══════════════════════════════════════════════════════════
     /UZYJ
  ═══════════════════════════════════════════════════════════ */

  if (name === 'uzyj') {
    const id =
      i.options.getString(
        'przedmiot',
        true,
      );

    const ok =
      store.use(
        guild,
        i.user.id,
        id,
      );

    const when =
      store.user(
        guild,
        i.user.id,
      ).booster_until;

    await say(
      i,
      ok
        ? id === 'xp_boost'
          ? `✨ Aktywowano **+50% XP**.\nEfekt pozostanie aktywny do ${stamp(when)}.\n\nBooster serwera **2× XP** nadal działa niezależnie.`
          : `👑 Twój nowy tytuł to **${items[id].title}**.`
        : '✦ Nie posiadasz tego przedmiotu w plecaku.',
      true,
    );

    return true;
  }


  /* ═══════════════════════════════════════════════════════════
     /MONETA
  ═══════════════════════════════════════════════════════════ */

  if (name === 'moneta') {
    const choice =
      i.options.getString(
        'strona',
        true,
      );

    const stake =
      i.options.getInteger(
        'stawka',
      ) || 0;

    const result =
      crypto.randomInt(2)
        ? 'orzel'
        : 'reszka';

    const won =
      choice === result;

    let balance;

    if (stake) {
      balance =
        store.wager(
          guild,
          i.user.id,
          stake,
          won
            ? stake * 2
            : 0,
        );

      if (balance === false) {
        await say(
          i,
          '✦ Nie masz wystarczającej liczby monet na taką stawkę.',
          true,
        );

        return true;
      }
    }

    await say(
      i,
      `🪙 Moneta została rzucona...\n\n` +
      `Wypadła **${result === 'orzel' ? 'ORZEŁ' : 'RESZKA'}**!\n` +
      `${won ? '✦ Wygrywasz!' : '✦ Tym razem przegrywasz.'}` +
      (
        stake
          ? `\n\nBilans rundy: **${won ? '+' : ''}${fmt(won ? stake : -stake)} ◈**\nSaldo: **${fmt(balance)} ◈**`
          : ''
      ),
    );

    return true;
  }


  /* ═══════════════════════════════════════════════════════════
     /SLOTY
  ═══════════════════════════════════════════════════════════ */

  if (name === 'sloty') {
    const stake =
      i.options.getInteger(
        'stawka',
        true,
      );

    const symbols = [
      '💎',
      '⭐',
      '🍒',
      '⚡',
      '🍀',
      '7️⃣',
    ];

    const rolls =
      Array.from(
        {
          length: 3,
        },
        () =>
          symbols[
            crypto.randomInt(
              symbols.length,
            )
          ],
      );

    const triple =
      rolls[0] === rolls[1] &&
      rolls[1] === rolls[2];

    const pair =
      new Set(rolls).size === 2;

    const payout =
      triple
        ? stake *
          (
            rolls[0] === '💎'
              ? 8
              : 5
          )
        : pair
          ? Math.floor(
              stake * 1.5,
            )
          : 0;

    const balance =
      store.wager(
        guild,
        i.user.id,
        stake,
        payout,
      );

    if (balance === false) {
      await say(
        i,
        '✦ Nie masz wystarczającej liczby monet na taką stawkę.',
        true,
      );

      return true;
    }

    await say(
      i,
      `🎰 **WYMIAR ZERQONA · SLOTY**\n\n` +
      `┃ ${rolls.join('  │  ')} ┃\n\n` +
      `${triple ? '💎 **JACKPOT!**' : pair ? '✦ **PARA!**' : '✦ Brak trafienia.'}\n\n` +
      `Stawka: **${fmt(stake)} ◈**\n` +
      `Wygrana: **${fmt(payout)} ◈**\n` +
      `Saldo: **${fmt(balance)} ◈**`,
    );

    return true;
  }


  /* ═══════════════════════════════════════════════════════════
     /KOSTKA
  ═══════════════════════════════════════════════════════════ */

  if (name === 'kostka') {
    const sides =
      i.options.getInteger(
        'sciany',
      ) || 6;

    await say(
      i,
      `🎲 Rzut kostką **k${sides}**...\nWynik: **${crypto.randomInt(1, sides + 1)}**.`,
    );

    return true;
  }


  /* ═══════════════════════════════════════════════════════════
     /WROZBA
  ═══════════════════════════════════════════════════════════ */

  if (name === 'wrozba') {
    await say(
      i,
      `🎱 **Magiczna kula ZERQONA**\n\n` +
      `> ${i.options.getString('pytanie', true)}\n\n` +
      `✦ **${phrases[crypto.randomInt(phrases.length)]}**`,
    );

    return true;
  }


  /* ═══════════════════════════════════════════════════════════
     /KPN
  ═══════════════════════════════════════════════════════════ */

  if (name === 'kpn') {
    const picks = [
      'kamien',
      'papier',
      'nozyce',
    ];

    const you =
      i.options.getString(
        'wybor',
        true,
      );

    const bot =
      picks[
        crypto.randomInt(3)
      ];

    const a =
      picks.indexOf(you);

    const b =
      picks.indexOf(bot);

    const result =
      a === b
        ? 'Remis!'
        : (a - b + 3) % 3 === 1
          ? 'Wygrywasz!'
          : 'Wygrywa bot!';

    await say(
      i,
      `✊ **Kamień • Papier • Nożyce**\n\n` +
      `Ty: **${you}**\n` +
      `ZERQON: **${bot}**\n\n` +
      `✦ **${result}**`,
    );

    return true;
  }


  /* ═══════════════════════════════════════════════════════════
     /ANKIETA
  ═══════════════════════════════════════════════════════════ */

  if (name === 'ankieta') {
    const q =
      i.options.getString(
        'pytanie',
        true,
      );

    const opts =
      [1, 2, 3, 4]
        .map(
          (n) =>
            i.options.getString(
              `opcja${n}`,
            ),
        )
        .filter(Boolean);

    const emojis = [
      '1️⃣',
      '2️⃣',
      '3️⃣',
      '4️⃣',
    ];

    const embed =
      new EmbedBuilder()
        .setColor(
          COLORS.PRIMARY,
        )
        .setTitle(
          `📊 ${q}`,
        )
        .setDescription(
          opts
            .map(
              (opt, n) =>
                `${emojis[n]} **${opt}**`,
            )
            .join('\n\n'),
        )
        .setFooter({
          text: `Ankieta utworzona przez ${i.user.username} • Wymiar ZERQONA`,
        });

    await i.reply({
      embeds: [embed],
      allowedMentions: {
        parse: [],
      },
    });

    const msg =
      await i.fetchReply();

    for (
      const emoji of emojis.slice(
        0,
        opts.length,
      )
    ) {
      await msg
        .react(emoji)
        .catch(() => {});
    }

    return true;
  }


  /* ═══════════════════════════════════════════════════════════
     /USERINFO
  ═══════════════════════════════════════════════════════════ */

  if (name === 'userinfo') {
    const {
      user,
      member,
    } = await target(i);

    const desc = [
      `**Użytkownik:** <@${user.id}>`,
      `**ID:** \`${user.id}\``,
      '',
      `**Utworzenie konta:** ${stamp(user.createdTimestamp)}`,
      `**Dołączenie na serwer:** ${
        member?.joinedTimestamp
          ? stamp(member.joinedTimestamp)
          : 'Użytkownik nie znajduje się na serwerze'
      }`,
      '',
      `**Poziom:** ${levelForXp(store.user(guild, user.id).xp)}`,
      `**Role:** ${
        member?.roles.cache
          .filter(
            (role) =>
              role.id !== guild,
          )
          .map(
            (role) =>
              role.toString(),
          )
          .slice(0, 15)
          .join(' ') ||
        'Brak dodatkowych ról'
      }`,
    ].join('\n');

    const embed =
      new EmbedBuilder()
        .setColor(
          COLORS.PRIMARY,
        )
        .setTitle(
          `✦ ${user.username}`,
        )
        .setThumbnail(
          user.displayAvatarURL(),
        )
        .setDescription(desc)
        .setFooter({
          text: 'Wymiar ZERQONA • Informacje o użytkowniku',
        });

    await i.reply({
      embeds: [embed],
    });

    return true;
  }


  /* ═══════════════════════════════════════════════════════════
     /SERVERINFO
  ═══════════════════════════════════════════════════════════ */

  if (name === 'serverinfo') {
    const g = i.guild;

    const embed =
      new EmbedBuilder()
        .setColor(
          COLORS.PRIMARY,
        )
        .setTitle(
          `✦ ${g.name}`,
        )
        .setDescription(
          'Podstawowe informacje i statystyki serwera.',
        )
        .addFields(
          {
            name: '👥 Osoby',
            value: fmt(
              g.memberCount,
            ),
            inline: true,
          },
          {
            name: '◆ Kanały',
            value: String(
              g.channels.cache.size,
            ),
            inline: true,
          },
          {
            name: '✦ Boosty',
            value: String(
              g.premiumSubscriptionCount ||
                0,
            ),
            inline: true,
          },
          {
            name: '◈ Serwer utworzono',
            value: stamp(
              g.createdTimestamp,
            ),
            inline: false,
          },
        )
        .setFooter({
          text: 'Wymiar ZERQONA • Informacje o serwerze',
        });

    if (g.iconURL()) {
      embed.setThumbnail(
        g.iconURL(),
      );
    }

    await i.reply({
      embeds: [embed],
    });

    return true;
  }


  /* ───────────────────────────────────────────────────────── */

  return false;
}
