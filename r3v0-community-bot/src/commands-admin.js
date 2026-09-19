import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';

import { config } from './config.js';
import { announceLevel, syncLevelRoles } from './experience.js';
import { logStaffAction } from './logs.js';
import { diagnose } from './diagnostics.js';

/* ============================================================================
   ZERQOON / WYMIAR ZERQOONA — ADMIN COMMAND HANDLER
   Jeden plik. Bez dodatkowego permissions.js i bez zmian w bazie/store.
   ========================================================================== */

const LEVEL = Object.freeze({
  USER: 0,
  HELPER: 1,
  MODERATOR: 2,
  CHIEF: 3,
});

const LEVEL_NAME = Object.freeze({
  [LEVEL.USER]: 'Użytkownik',
  [LEVEL.HELPER]: 'Strażnik',
  [LEVEL.MODERATOR]: 'Namiestnik',
  [LEVEL.CHIEF]: 'Szef',
});

/**
 * Centralna tabela dostępu.
 * Dzięki temu nie trzeba utrzymywać kilku osobnych tablic i ternary.
 */
const COMMANDS = Object.freeze({
  // Każdy użytkownik
  ostrzezenia: {
    level: LEVEL.USER,
  },

  // Strażnik / Helper
  warn: {
    level: LEVEL.HELPER,
  },
  unwarn: {
    level: LEVEL.HELPER,
  },
  userinfo: {
    level: LEVEL.HELPER,
  },
  serverinfo: {
    level: LEVEL.HELPER,
  },
  uprawnienia: {
    level: LEVEL.HELPER,
  },

  // Namiestnik / Moderator
  wyczysc: {
    level: LEVEL.MODERATOR,
    botPermission: PermissionFlagsBits.ManageMessages,
    permissionName: 'Zarządzanie wiadomościami',
  },
  timeout: {
    level: LEVEL.MODERATOR,
    botPermission: PermissionFlagsBits.ModerateMembers,
    permissionName: 'Moderowanie użytkowników',
  },
  untimeout: {
    level: LEVEL.MODERATOR,
    botPermission: PermissionFlagsBits.ModerateMembers,
    permissionName: 'Moderowanie użytkowników',
  },
  kick: {
    level: LEVEL.MODERATOR,
    botPermission: PermissionFlagsBits.KickMembers,
    permissionName: 'Wyrzucanie użytkowników',
  },
  ban: {
    level: LEVEL.MODERATOR,
    botPermission: PermissionFlagsBits.BanMembers,
    permissionName: 'Banowanie użytkowników',
  },
  unban: {
    level: LEVEL.MODERATOR,
    botPermission: PermissionFlagsBits.BanMembers,
    permissionName: 'Banowanie użytkowników',
  },
  slowmode: {
    level: LEVEL.MODERATOR,
    botPermission: PermissionFlagsBits.ManageChannels,
    permissionName: 'Zarządzanie kanałami',
  },
  zamknij: {
    level: LEVEL.MODERATOR,
    botPermission: PermissionFlagsBits.ManageChannels,
    permissionName: 'Zarządzanie kanałami',
  },
  otworz: {
    level: LEVEL.MODERATOR,
    botPermission: PermissionFlagsBits.ManageChannels,
    permissionName: 'Zarządzanie kanałami',
  },
  ukryj: {
    level: LEVEL.MODERATOR,
    botPermission: PermissionFlagsBits.ManageChannels,
    permissionName: 'Zarządzanie kanałami',
  },
  pokaz: {
    level: LEVEL.MODERATOR,
    botPermission: PermissionFlagsBits.ManageChannels,
    permissionName: 'Zarządzanie kanałami',
  },
  nick: {
    level: LEVEL.MODERATOR,
    botPermission: PermissionFlagsBits.ManageNicknames,
    permissionName: 'Zarządzanie pseudonimami',
  },
  przenies: {
    level: LEVEL.MODERATOR,
    botPermission: PermissionFlagsBits.MoveMembers,
    permissionName: 'Przenoszenie użytkowników',
  },
  rozlacz: {
    level: LEVEL.MODERATOR,
    botPermission: PermissionFlagsBits.MoveMembers,
    permissionName: 'Przenoszenie użytkowników',
  },

  // Szef
  rola: {
    level: LEVEL.CHIEF,
    botPermission: PermissionFlagsBits.ManageRoles,
    permissionName: 'Zarządzanie rolami',
  },
  xp: {
    level: LEVEL.CHIEF,
  },
  monety_admin: {
    level: LEVEL.CHIEF,
  },
  diagnostyka: {
    level: LEVEL.CHIEF,
  },
});

const ALIASES = Object.freeze({
  mute: 'timeout',
  unmute: 'untimeout',
  clear: 'wyczysc',
  purge: 'wyczysc',
  lock: 'zamknij',
  unlock: 'otworz',
});

/* ============================================================================
   HELPERY
   ========================================================================== */

function commandName(i) {
  return ALIASES[i.commandName] || i.commandName;
}

function tier(i) {
  if (!i.guild || !i.member) return LEVEL.USER;

  if (i.user.id === i.guild.ownerId) {
    return LEVEL.CHIEF;
  }

  if (
    config.roles?.chief &&
    i.member.roles.cache.has(config.roles.chief)
  ) {
    return LEVEL.CHIEF;
  }

  if (
    config.roles?.moderator &&
    i.member.roles.cache.has(config.roles.moderator)
  ) {
    return LEVEL.MODERATOR;
  }

  if (
    config.roles?.helper &&
    i.member.roles.cache.has(config.roles.helper)
  ) {
    return LEVEL.HELPER;
  }

  return LEVEL.USER;
}

function requiredLabel(level) {
  if (level >= LEVEL.CHIEF) return 'Szef';
  if (level >= LEVEL.MODERATOR) return 'Namiestnik lub Szef';
  if (level >= LEVEL.HELPER) return 'Strażnik, Namiestnik lub Szef';
  return 'Każdy użytkownik';
}

function cleanText(value, max = 1000) {
  return String(value ?? '—')
    .replace(/```/g, 'ˋˋˋ')
    .slice(0, max);
}

function unix(ms) {
  return Math.floor(Number(ms) / 1000);
}

function clamp(number, min, max) {
  return Math.min(max, Math.max(min, number));
}

function formatError(error) {
  switch (error?.code) {
    case 50013:
      return 'Bot nie posiada wymaganych uprawnień Discorda.';
    case 50035:
      return 'Discord odrzucił dane komendy. Sprawdź podane wartości.';
    case 10007:
      return 'Nie znaleziono tego użytkownika na serwerze.';
    case 10013:
      return 'Nie znaleziono tego użytkownika.';
    case 10026:
      return 'Nie znaleziono takiego bana.';
    case 10003:
      return 'Nie znaleziono kanału.';
    default:
      return 'Nie udało się wykonać komendy. Szczegóły błędu zapisano w konsoli bota.';
  }
}

async function reply(i, content, extra = {}) {
  const data = {
    content,
    allowedMentions: { parse: [] },
    ...extra,
  };

  if (i.deferred || i.replied) {
    return i.editReply(data);
  }

  return i.reply({
    ...data,
    flags: MessageFlags.Ephemeral,
  });
}

async function defer(i) {
  if (!i.deferred && !i.replied) {
    await i.deferReply({
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function member(i, optionName = 'osoba', required = true) {
  const user = i.options.getUser(optionName, required);

  if (!user) return null;

  return i.guild.members.fetch(user.id).catch(() => null);
}

function rawReason(i, fallback = 'Brak podanego powodu') {
  return (
    i.options.getString('powod', false)?.trim() ||
    fallback
  ).slice(0, 400);
}

function reason(i, fallback = 'Brak podanego powodu') {
  return `${rawReason(i, fallback)} | Moderator: ${i.user.username} (${i.user.id})`
    .slice(0, 500);
}

function canAct(i, target, { allowBots = false } = {}) {
  if (!target) return false;
  if (!i.guild || !i.member) return false;

  // Owner serwera jest nietykalny.
  if (target.id === i.guild.ownerId) return false;

  // Moderator nie działa sam na sobie.
  if (target.id === i.user.id) return false;

  // Domyślnie blokujemy akcje na botach.
  if (!allowBots && target.user.bot) return false;

  // Hierarchia osoby wykonującej komendę.
  if (
    i.user.id !== i.guild.ownerId &&
    i.member.roles.highest.comparePositionTo(target.roles.highest) <= 0
  ) {
    return false;
  }

  // Hierarchia samego bota.
  const bot = i.guild.members.me;

  if (!bot) return false;

  if (
    bot.roles.highest.comparePositionTo(target.roles.highest) <= 0
  ) {
    return false;
  }

  return true;
}

function canManageRole(i, role) {
  if (!role || !i.guild || !i.member) return false;

  if (role.id === i.guild.id) return false;
  if (role.managed) return false;

  const bot = i.guild.members.me;

  if (!bot) return false;

  if (
    bot.roles.highest.comparePositionTo(role) <= 0
  ) {
    return false;
  }

  if (
    i.user.id !== i.guild.ownerId &&
    i.member.roles.highest.comparePositionTo(role) <= 0
  ) {
    return false;
  }

  return true;
}

function botHas(i, permission, channel = null) {
  const bot = i.guild?.members?.me;

  if (!bot) return false;

  if (channel && typeof bot.permissionsIn === 'function') {
    return bot.permissionsIn(channel).has(permission);
  }

  return bot.permissions.has(permission);
}

function botPermissionMessage(i, meta, channel = null) {
  if (!meta?.botPermission) return null;

  if (botHas(i, meta.botPermission, channel)) {
    return null;
  }

  return `❌ Bot nie posiada uprawnienia **${meta.permissionName || 'wymaganego do tej komendy'}**.`;
}

async function staffLog(i, action, targetId, details) {
  try {
    await logStaffAction(
      i.guild,
      action,
      i.user.id,
      targetId ?? null,
      cleanText(details, 1800),
    );
  } catch (error) {
    console.warn(
      `[ADMIN LOG:${action}]`,
      error?.message || error,
    );
  }
}

function permissionNames(member) {
  if (!member?.permissions) return [];

  return member.permissions
    .toArray()
    .sort((a, b) => a.localeCompare(b));
}

function rolesText(target, max = 15) {
  if (!target?.roles?.cache) return 'Brak';

  const roles = target.roles.cache
    .filter((role) => role.id !== target.guild.id)
    .sort((a, b) => b.position - a.position)
    .first(max)
    .map((role) => `<@&${role.id}>`);

  return roles.length ? roles.join(', ') : 'Brak';
}

/* ============================================================================
   HANDLER
   ========================================================================== */

export async function handleAdmin(i, store) {
  const name = commandName(i);
  const meta = COMMANDS[name];

  if (!meta) {
    return false;
  }

  if (!i.guild || !i.member) {
    return false;
  }

  const guild = i.guildId;
  const level = tier(i);

  /* ------------------------------------------------------------------------
     /ostrzezenia
     Ta komenda może być użyta przez każdego do sprawdzenia siebie.
     Cudze ostrzeżenia widzi ekipa.
     ---------------------------------------------------------------------- */

  if (name === 'ostrzezenia') {
    const target =
      i.options.getUser('osoba', false) ||
      i.user;

    if (
      target.id !== i.user.id &&
      level < LEVEL.HELPER
    ) {
      await reply(
        i,
        '❌ Cudze ostrzeżenia może sprawdzać tylko ekipa serwera.',
      );
      return true;
    }

    const warnings = store.warnings(guild, target.id);

    if (!warnings.length) {
      await reply(
        i,
        `✅ <@${target.id}> nie ma aktywnych ostrzeżeń.`,
      );
      return true;
    }

    const rows = warnings
      .slice(0, 20)
      .map((warning) => {
        const created = unix(warning.created_at);
        const text = cleanText(
          warning.reason || 'Brak powodu',
          110,
        ).replace(/\n/g, ' ');

        return (
          `**#${warning.id}** • ` +
          `<t:${created}:d> • ` +
          `${text} • ` +
          `od <@${warning.moderator_id}>`
        );
      });

    const hidden = Math.max(
      0,
      warnings.length - rows.length,
    );

    await reply(
      i,
      `⚠️ **Ostrzeżenia <@${target.id}> (${warnings.length})**\n` +
      rows.join('\n') +
      (hidden
        ? `\n…oraz jeszcze **${hidden}**.`
        : ''),
    );

    return true;
  }

  /* ------------------------------------------------------------------------
     Rangi
     ---------------------------------------------------------------------- */

  if (level < meta.level) {
    await reply(
      i,
      `❌ Nie masz wymaganej roli do tej komendy.\n` +
      `Wymagane: **${requiredLabel(meta.level)}**.`,
    );
    return true;
  }

  await defer(i);

  try {
    /* ======================================================================
       DIAGNOSTYKA
       ==================================================================== */

    if (name === 'diagnostyka') {
      const lines = await diagnose(i.guild);

      const permissions = [
        [
          'ModerateMembers',
          PermissionFlagsBits.ModerateMembers,
        ],
        [
          'KickMembers',
          PermissionFlagsBits.KickMembers,
        ],
        [
          'BanMembers',
          PermissionFlagsBits.BanMembers,
        ],
        [
          'ManageMessages',
          PermissionFlagsBits.ManageMessages,
        ],
        [
          'ManageRoles',
          PermissionFlagsBits.ManageRoles,
        ],
        [
          'ManageChannels',
          PermissionFlagsBits.ManageChannels,
        ],
        [
          'ManageNicknames',
          PermissionFlagsBits.ManageNicknames,
        ],
        [
          'MoveMembers',
          PermissionFlagsBits.MoveMembers,
        ],
        [
          'ViewAuditLog',
          PermissionFlagsBits.ViewAuditLog,
        ],
      ];

      const bot = i.guild.members.me;

      const perms = permissions.map(
        ([label, permission]) =>
          `${bot?.permissions.has(permission) ? '✅' : '❌'} ${label}`,
      );

      await reply(
        i,
        `🧪 **Stan konfiguracji**\n` +
        `${lines.join('\n').slice(0, 1200)}\n\n` +
        `🔐 **Uprawnienia bota**\n` +
        perms.join('\n'),
      );

      return true;
    }

    /* ======================================================================
       WARN
       ==================================================================== */

    if (name === 'warn') {
      const target = await member(i);

      if (!canAct(i, target)) {
        await reply(
          i,
          '❌ Nie można ostrzec tej osoby. Sprawdź członkostwo i hierarchię ról.',
        );
        return true;
      }

      const text = rawReason(i);

      const id = store.addWarning(
        guild,
        target.id,
        i.user.id,
        text,
      );

      await staffLog(
        i,
        'Ostrzeżenie',
        target.id,
        `#${id}: ${text}`,
      );

      await reply(
        i,
        `⚠️ Ostrzeżenie **#${id}** dla <@${target.id}> zostało zapisane.`,
      );

      return true;
    }

    /* ======================================================================
       UNWARN
       ==================================================================== */

    if (name === 'unwarn') {
      const id = i.options.getInteger(
        'numer',
        true,
      );

      if (id < 1) {
        await reply(
          i,
          '❌ Numer ostrzeżenia musi być większy od 0.',
        );
        return true;
      }

      const found = store.removeWarning(
        guild,
        id,
      );

      if (found) {
        await staffLog(
          i,
          'Usunięto ostrzeżenie',
          null,
          `#${id}`,
        );
      }

      await reply(
        i,
        found
          ? `✅ Usunięto ostrzeżenie **#${id}**.`
          : `❌ Nie znaleziono ostrzeżenia **#${id}**.`,
      );

      return true;
    }

    /* ======================================================================
       WYCZYŚĆ
       ==================================================================== */

    if (name === 'wyczysc') {
      const missing = botPermissionMessage(
        i,
        meta,
        i.channel,
      );

      if (missing) {
        await reply(i, missing);
        return true;
      }

      if (!i.channel?.bulkDelete) {
        await reply(
          i,
          '❌ Ta komenda działa wyłącznie na kanałach obsługujących usuwanie wiadomości.',
        );
        return true;
      }

      const requested = i.options.getInteger(
        'ilosc',
        true,
      );

      const count = clamp(
        requested,
        1,
        100,
      );

      const deleted = await i.channel.bulkDelete(
        count,
        true,
      );

      await staffLog(
        i,
        'Czyszczenie wiadomości',
        null,
        `<#${i.channelId}> • usunięto ${deleted.size}/${count}`,
      );

      await reply(
        i,
        `🧹 Usunięto **${deleted.size}** wiadomości.` +
        (
          deleted.size < count
            ? '\nCzęść wiadomości mogła mieć ponad 14 dni.'
            : ''
        ),
      );

      return true;
    }

    /* ======================================================================
       TIMEOUT / UNTIMEOUT / KICK / BAN
       ==================================================================== */

    if (
      [
        'timeout',
        'untimeout',
        'kick',
        'ban',
      ].includes(name)
    ) {
      const missing = botPermissionMessage(
        i,
        meta,
      );

      if (missing) {
        await reply(i, missing);
        return true;
      }

      const target = await member(i);

      if (!canAct(i, target)) {
        await reply(
          i,
          '❌ Nie można wykonać działania na tej osobie. Sprawdź hierarchię ról użytkownika i bota.',
        );
        return true;
      }

      if (name === 'timeout') {
        if (!target.moderatable) {
          await reply(
            i,
            '❌ Bot nie może nadać timeoutu tej osobie. Jego rola jest prawdopodobnie zbyt nisko.',
          );
          return true;
        }

        const minutes = i.options.getInteger(
          'minuty',
          true,
        );

        if (
          minutes < 1 ||
          minutes > 40320
        ) {
          await reply(
            i,
            '❌ Timeout może wynosić od **1 minuty do 40320 minut (28 dni)**.',
          );
          return true;
        }

        await target.timeout(
          minutes * 60_000,
          reason(i),
        );

        await staffLog(
          i,
          'Timeout',
          target.id,
          `${minutes} min • ${rawReason(i)}`,
        );

        await reply(
          i,
          `⏳ <@${target.id}> otrzymał timeout na **${minutes} min**.`,
        );

        return true;
      }

      if (name === 'untimeout') {
        if (!target.moderatable) {
          await reply(
            i,
            '❌ Bot nie może zmienić timeoutu tej osoby.',
          );
          return true;
        }

        await target.timeout(
          null,
          reason(i, 'Usunięcie timeoutu'),
        );

        await staffLog(
          i,
          'Usunięto timeout',
          target.id,
          rawReason(i, 'Usunięcie timeoutu'),
        );

        await reply(
          i,
          `✅ Zakończono timeout dla <@${target.id}>.`,
        );

        return true;
      }

      if (name === 'kick') {
        if (!target.kickable) {
          await reply(
            i,
            '❌ Bot nie może wyrzucić tej osoby z powodu hierarchii ról.',
          );
          return true;
        }

        const why = reason(i);

        await target.kick(why);

        await staffLog(
          i,
          'Kick',
          target.id,
          why,
        );

        await reply(
          i,
          `👢 Wyrzucono <@${target.id}> z serwera.`,
        );

        return true;
      }

      if (name === 'ban') {
        if (!target.bannable) {
          await reply(
            i,
            '❌ Bot nie może zbanować tej osoby z powodu hierarchii ról.',
          );
          return true;
        }

        const why = reason(i);

        const deleteDays = clamp(
          i.options.getInteger(
            'usun_dni',
            false,
          ) ?? 0,
          0,
          7,
        );

        await target.ban({
          reason: why,
          deleteMessageSeconds:
            deleteDays * 86400,
        });

        await staffLog(
          i,
          'Ban',
          target.id,
          `${why} • historia wiadomości: ${deleteDays} dni`,
        );

        await reply(
          i,
          `🔨 Zbanowano <@${target.id}>.`,
        );

        return true;
      }
    }

    /* ======================================================================
       UNBAN
       ==================================================================== */

    if (name === 'unban') {
      const missing = botPermissionMessage(
        i,
        meta,
      );

      if (missing) {
        await reply(i, missing);
        return true;
      }

      const id = i.options
        .getString('id', true)
        .trim();

      if (!/^\d{17,21}$/.test(id)) {
        await reply(
          i,
          '❌ Podaj prawidłowe ID użytkownika Discord.',
        );
        return true;
      }

      const why = reason(
        i,
        'Zdjęcie bana',
      );

      await i.guild.bans.remove(
        id,
        why,
      );

      await staffLog(
        i,
        'Unban',
        id,
        why,
      );

      await reply(
        i,
        `✅ Zdjęto bana z użytkownika **${id}**.`,
      );

      return true;
    }

    /* ======================================================================
       SLOWMODE / LOCK / UNLOCK / HIDE / SHOW
       ==================================================================== */

    if (
      [
        'slowmode',
        'zamknij',
        'otworz',
        'ukryj',
        'pokaz',
      ].includes(name)
    ) {
      const missing = botPermissionMessage(
        i,
        meta,
        i.channel,
      );

      if (missing) {
        await reply(i, missing);
        return true;
      }

      const channel = i.channel;

      if (!channel?.isTextBased()) {
        await reply(
          i,
          '❌ Ta komenda działa na kanale tekstowym serwera.',
        );
        return true;
      }

      if (name === 'slowmode') {
        if (!channel.setRateLimitPerUser) {
          await reply(
            i,
            '❌ Na tym kanale nie można ustawić slowmode.',
          );
          return true;
        }

        const seconds = i.options.getInteger(
          'sekundy',
          true,
        );

        if (
          seconds < 0 ||
          seconds > 21600
        ) {
          await reply(
            i,
            '❌ Slowmode musi wynosić od **0 do 21600 sekund**.',
          );
          return true;
        }

        await channel.setRateLimitPerUser(
          seconds,
          `Zmiana przez ${i.user.username} (${i.user.id})`,
        );

        await staffLog(
          i,
          'Zmiana slowmode',
          null,
          `<#${channel.id}> • ${seconds}s`,
        );

        await reply(
          i,
          `🐌 Slowmode ustawiony na **${seconds} s**.`,
        );

        return true;
      }

      if (!channel.permissionOverwrites) {
        await reply(
          i,
          '❌ Ten kanał nie obsługuje nadpisanych uprawnień.',
        );
        return true;
      }

      if (
        name === 'zamknij' ||
        name === 'otworz'
      ) {
        const locked =
          name === 'zamknij';

        await channel.permissionOverwrites.edit(
          i.guild.roles.everyone,
          {
            SendMessages:
              locked
                ? false
                : null,
          },
          {
            reason:
              `Zmiana przez ${i.user.username} (${i.user.id})`,
          },
        );

        await staffLog(
          i,
          locked
            ? 'Zamknięto kanał'
            : 'Otwarto kanał',
          null,
          `<#${channel.id}>`,
        );

        await reply(
          i,
          locked
            ? '🔒 Kanał został zamknięty dla @everyone.'
            : '🔓 Przywrócono dziedziczone prawo pisania dla @everyone.',
        );

        return true;
      }

      const hidden =
        name === 'ukryj';

      await channel.permissionOverwrites.edit(
        i.guild.roles.everyone,
        {
          ViewChannel:
            hidden
              ? false
              : null,
        },
        {
          reason:
            `Zmiana przez ${i.user.username} (${i.user.id})`,
        },
      );

      await staffLog(
        i,
        hidden
          ? 'Ukryto kanał'
          : 'Pokazano kanał',
        null,
        `<#${channel.id}>`,
      );

      await reply(
        i,
        hidden
          ? '🙈 Kanał został ukryty dla @everyone.'
          : '👁️ Przywrócono dziedziczoną widoczność kanału.',
      );

      return true;
    }

    /* ======================================================================
       ROLA
       ==================================================================== */

    if (name === 'rola') {
      const missing = botPermissionMessage(
        i,
        meta,
      );

      if (missing) {
        await reply(i, missing);
        return true;
      }

      const target = await member(i);

      const role = i.options.getRole(
        'rola',
        true,
      );

      const action =
        i.options.getSubcommand();

      if (
        !canAct(
          i,
          target,
          { allowBots: true },
        )
      ) {
        await reply(
          i,
          '❌ Nie można zmienić roli tej osoby. Sprawdź hierarchię.',
        );
        return true;
      }

      if (!canManageRole(i, role)) {
        await reply(
          i,
          '❌ Nie można zarządzać tą rolą. Sprawdź pozycję roli, integracje i hierarchię bota.',
        );
        return true;
      }

      if (action === 'nadaj') {
        if (
          target.roles.cache.has(role.id)
        ) {
          await reply(
            i,
            `${target} już posiada rolę ${role}.`,
          );
          return true;
        }

        await target.roles.add(
          role,
          `Nadano przez ${i.user.username} (${i.user.id})`,
        );

        await staffLog(
          i,
          'Nadano rolę',
          target.id,
          `${role.name} (${role.id})`,
        );

        await reply(
          i,
          `✅ Nadano ${role} użytkownikowi ${target}.`,
        );

        return true;
      }

      if (
        !target.roles.cache.has(role.id)
      ) {
        await reply(
          i,
          `${target} nie posiada roli ${role}.`,
        );
        return true;
      }

      await target.roles.remove(
        role,
        `Usunięto przez ${i.user.username} (${i.user.id})`,
      );

      await staffLog(
        i,
        'Usunięto rolę',
        target.id,
        `${role.name} (${role.id})`,
      );

      await reply(
        i,
        `➖ Usunięto ${role} użytkownikowi ${target}.`,
      );

      return true;
    }

    /* ======================================================================
       NICK
       Nowa komenda: /nick osoba nick
       Pusty nick = usuń nickname.
       ==================================================================== */

    if (name === 'nick') {
      const missing = botPermissionMessage(
        i,
        meta,
      );

      if (missing) {
        await reply(i, missing);
        return true;
      }

      const target = await member(i);

      if (
        !canAct(
          i,
          target,
          { allowBots: true },
        ) ||
        !target.manageable
      ) {
        await reply(
          i,
          '❌ Bot nie może zmienić pseudonimu tej osoby.',
        );
        return true;
      }

      const nickname =
        i.options
          .getString('nick', false)
          ?.trim() ||
        null;

      if (
        nickname &&
        nickname.length > 32
      ) {
        await reply(
          i,
          '❌ Pseudonim może mieć maksymalnie **32 znaki**.',
        );
        return true;
      }

      await target.setNickname(
        nickname,
        `Zmiana przez ${i.user.username} (${i.user.id})`,
      );

      await staffLog(
        i,
        nickname
          ? 'Zmiana pseudonimu'
          : 'Usunięcie pseudonimu',
        target.id,
        nickname ||
          'Przywrócono domyślną nazwę',
      );

      await reply(
        i,
        nickname
          ? `✏️ Ustawiono pseudonim <@${target.id}> na **${cleanText(nickname, 32)}**.`
          : `✅ Usunięto pseudonim użytkownika <@${target.id}>.`,
      );

      return true;
    }

    /* ======================================================================
       PRZENIEŚ VC
       Nowa komenda: /przenies osoba kanal
       ==================================================================== */

    if (name === 'przenies') {
      const missing = botPermissionMessage(
        i,
        meta,
      );

      if (missing) {
        await reply(i, missing);
        return true;
      }

      const target = await member(i);

      const channel =
        i.options.getChannel(
          'kanal',
          true,
        );

      if (
        !canAct(
          i,
          target,
          { allowBots: true },
        )
      ) {
        await reply(
          i,
          '❌ Nie można przenieść tej osoby.',
        );
        return true;
      }

      if (!target.voice?.channelId) {
        await reply(
          i,
          '❌ Ta osoba nie znajduje się na kanale głosowym.',
        );
        return true;
      }

      if (!channel.isVoiceBased()) {
        await reply(
          i,
          '❌ Wybierz kanał głosowy.',
        );
        return true;
      }

      await target.voice.setChannel(
        channel,
        `Przeniesiono przez ${i.user.username} (${i.user.id})`,
      );

      await staffLog(
        i,
        'Przeniesienie głosowe',
        target.id,
        `<#${channel.id}>`,
      );

      await reply(
        i,
        `🔊 Przeniesiono <@${target.id}> na ${channel}.`,
      );

      return true;
    }

    /* ======================================================================
       ROZŁĄCZ VC
       Nowa komenda: /rozlacz osoba
       ==================================================================== */

    if (name === 'rozlacz') {
      const missing = botPermissionMessage(
        i,
        meta,
      );

      if (missing) {
        await reply(i, missing);
        return true;
      }

      const target = await member(i);

      if (
        !canAct(
          i,
          target,
          { allowBots: true },
        )
      ) {
        await reply(
          i,
          '❌ Nie można rozłączyć tej osoby.',
        );
        return true;
      }

      if (!target.voice?.channelId) {
        await reply(
          i,
          '❌ Ta osoba nie znajduje się na kanale głosowym.',
        );
        return true;
      }

      const oldChannel =
        target.voice.channelId;

      await target.voice.disconnect(
        `Rozłączono przez ${i.user.username} (${i.user.id})`,
      );

      await staffLog(
        i,
        'Rozłączenie głosowe',
        target.id,
        `<#${oldChannel}>`,
      );

      await reply(
        i,
        `🔇 Rozłączono <@${target.id}> z kanału głosowego.`,
      );

      return true;
    }

    /* ======================================================================
       USERINFO
       Nowa komenda: /userinfo [osoba]
       ==================================================================== */

    if (name === 'userinfo') {
      const target =
        (
          await member(
            i,
            'osoba',
            false,
          )
        ) ||
        i.member;

      const embed =
        new EmbedBuilder()
          .setColor(0x8b5cf6)
          .setAuthor({
            name:
              target.user.tag ||
              target.user.username,
            iconURL:
              target.user.displayAvatarURL(),
          })
          .setThumbnail(
            target.user.displayAvatarURL({
              size: 256,
            }),
          )
          .addFields(
            {
              name: 'Użytkownik',
              value: `<@${target.id}>`,
              inline: true,
            },
            {
              name: 'ID',
              value: target.id,
              inline: true,
            },
            {
              name: 'Bot',
              value:
                target.user.bot
                  ? 'Tak'
                  : 'Nie',
              inline: true,
            },
            {
              name: 'Konto utworzone',
              value:
                `<t:${unix(target.user.createdTimestamp)}:F>\n` +
                `<t:${unix(target.user.createdTimestamp)}:R>`,
              inline: false,
            },
            {
              name: 'Dołączył do serwera',
              value:
                target.joinedTimestamp
                  ? (
                    `<t:${unix(target.joinedTimestamp)}:F>\n` +
                    `<t:${unix(target.joinedTimestamp)}:R>`
                  )
                  : 'Brak danych',
              inline: false,
            },
            {
              name: 'Najwyższa rola',
              value:
                target.roles.highest?.toString() ||
                'Brak',
              inline: true,
            },
            {
              name: 'Liczba ról',
              value:
                String(
                  Math.max(
                    0,
                    target.roles.cache.size - 1,
                  ),
                ),
              inline: true,
            },
            {
              name: 'Role',
              value: rolesText(target),
              inline: false,
            },
          )
          .setFooter({
            text:
              `Sprawdził ${i.user.username}`,
          })
          .setTimestamp();

      await i.editReply({
        embeds: [embed],
        allowedMentions: {
          parse: [],
        },
      });

      return true;
    }

    /* ======================================================================
       SERVERINFO
       Nowa komenda: /serverinfo
       ==================================================================== */

    if (name === 'serverinfo') {
      const owner =
        await i.guild
          .fetchOwner()
          .catch(() => null);

      const embed =
        new EmbedBuilder()
          .setColor(0x8b5cf6)
          .setTitle(
            `🛡️ ${i.guild.name}`,
          )
          .setThumbnail(
            i.guild.iconURL({
              size: 256,
            }) ||
            null,
          )
          .addFields(
            {
              name: 'ID serwera',
              value: i.guild.id,
              inline: true,
            },
            {
              name: 'Owner',
              value:
                owner
                  ? `<@${owner.id}>`
                  : 'Brak danych',
              inline: true,
            },
            {
              name: 'Użytkownicy',
              value:
                String(i.guild.memberCount),
              inline: true,
            },
            {
              name: 'Kanały',
              value:
                String(
                  i.guild.channels.cache.size,
                ),
              inline: true,
            },
            {
              name: 'Role',
              value:
                String(
                  i.guild.roles.cache.size,
                ),
              inline: true,
            },
            {
              name: 'Boosty',
              value:
                String(
                  i.guild.premiumSubscriptionCount ??
                  0,
                ),
              inline: true,
            },
            {
              name: 'Poziom boostów',
              value:
                String(
                  i.guild.premiumTier ??
                  0,
                ),
              inline: true,
            },
            {
              name: 'Serwer utworzony',
              value:
                `<t:${unix(i.guild.createdTimestamp)}:F>\n` +
                `<t:${unix(i.guild.createdTimestamp)}:R>`,
              inline: false,
            },
          )
          .setTimestamp();

      await i.editReply({
        embeds: [embed],
        allowedMentions: {
          parse: [],
        },
      });

      return true;
    }

    /* ======================================================================
       UPRAWNIENIA
       Nowa komenda: /uprawnienia [osoba]
       ==================================================================== */

    if (name === 'uprawnienia') {
      const target =
        (
          await member(
            i,
            'osoba',
            false,
          )
        ) ||
        i.member;

      const names =
        permissionNames(target);

      const list =
        names.length
          ? names
              .map(
                (permission) =>
                  `\`${permission}\``,
              )
              .join(', ')
              .slice(0, 1800)
          : 'Brak uprawnień.';

      const embed =
        new EmbedBuilder()
          .setColor(0x8b5cf6)
          .setTitle(
            '🔐 Uprawnienia użytkownika',
          )
          .setDescription(
            `<@${target.id}>\n\n${list}`,
          )
          .addFields({
            name: 'Poziom w systemie bota',
            value:
              LEVEL_NAME[
                target.id === i.user.id
                  ? level
                  : (
                    target.id === i.guild.ownerId
                      ? LEVEL.CHIEF
                      : (
                        target.roles.cache.has(
                          config.roles?.chief,
                        )
                          ? LEVEL.CHIEF
                          : (
                            target.roles.cache.has(
                              config.roles?.moderator,
                            )
                              ? LEVEL.MODERATOR
                              : (
                                target.roles.cache.has(
                                  config.roles?.helper,
                                )
                                  ? LEVEL.HELPER
                                  : LEVEL.USER
                              )
                          )
                      )
                  )
              ],
            inline: false,
          })
          .setTimestamp();

      await i.editReply({
        embeds: [embed],
        allowedMentions: {
          parse: [],
        },
      });

      return true;
    }

    /* ======================================================================
       XP / MONETY ADMIN
       ==================================================================== */

    if (
      name === 'xp' ||
      name === 'monety_admin'
    ) {
      const target = await member(i);

      const action =
        i.options.getSubcommand();

      const value =
        i.options.getInteger(
          'ilosc',
          true,
        );

      if (
        !target ||
        target.user.bot
      ) {
        await reply(
          i,
          '❌ Wybierz użytkownika z serwera, który nie jest botem.',
        );
        return true;
      }

      if (value < 0) {
        await reply(
          i,
          '❌ `ilosc` musi być dodatnia. Do odejmowania użyj subkomendy **odejmij**.',
        );
        return true;
      }

      if (name === 'xp') {
        const result =
          action === 'ustaw'
            ? store.setXp(
              guild,
              target.id,
              value,
            )
            : store.changeXp(
              guild,
              target.id,
              action === 'dodaj'
                ? value
                : -value,
            );

        await syncLevelRoles(
          target,
          result.level,
        );

        if (
          result.level >
          result.oldLevel
        ) {
          await announceLevel(
            target,
            result,
            store,
          );
        }

        await staffLog(
          i,
          'Korekta XP',
          target.id,
          `${action} ${value}; teraz ${result.xp} XP; poziom ${result.level}`,
        );

        await reply(
          i,
          `✨ XP <@${target.id}>: **${result.xp}**\n` +
          `Poziom: **${result.level}**.`,
        );

        return true;
      }

      let balance =
        action === 'ustaw'
          ? store.setBalance(
            guild,
            target.id,
            value,
          )
          : store.changeBalance(
            guild,
            target.id,
            action === 'dodaj'
              ? value
              : -value,
          );

      // Jeżeli store pozwala na saldo ujemne, zabezpieczamy je do zera.
      if (balance < 0) {
        balance =
          store.setBalance(
            guild,
            target.id,
            0,
          );
      }

      await staffLog(
        i,
        'Korekta monet',
        target.id,
        `${action} ${value}; teraz ${balance} ◈`,
      );

      await reply(
        i,
        `💰 Saldo <@${target.id}>: **${balance} ◈**.`,
      );

      return true;
    }

    return false;
  } catch (error) {
    console.error(
      `[ADMIN:${name}]`,
      error,
    );

    await reply(
      i,
      `❌ ${formatError(error)}`,
    ).catch(() => {});

    return true;
  }
}
