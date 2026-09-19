import {
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';

import { config } from './config.js';
import { items } from './shop.js';
import { handlePublic } from './commands-public.js';
import { handleAdmin } from './commands-admin.js';


/* ─────────────────────────────────────────────────────────────
   WYMIAR ZERQONA — SLASH COMMAND REGISTRY
───────────────────────────────────────────────────────────── */


/* ─────────────────────────────────────────────────────────────
   SHARED OPTIONS
───────────────────────────────────────────────────────────── */

const choices = Object.entries(items).map(
  ([value, item]) => ({
    name: item.name,
    value,
  }),
);

const user = (option) =>
  option
    .setName('osoba')
    .setDescription('Wybierz użytkownika na serwerze')
    .setRequired(true);

const reason = (option) =>
  option
    .setName('powod')
    .setDescription('Podaj powód wykonania działania')
    .setMaxLength(400)
    .setRequired(true);

const amount = (option) =>
  option
    .setName('ilosc')
    .setDescription('Podaj wymaganą liczbę')
    .setMinValue(1)
    .setMaxValue(1_000_000_000)
    .setRequired(true);


/* ─────────────────────────────────────────────────────────────
   COMMANDS
───────────────────────────────────────────────────────────── */

export const commands = [

  /* ═══════════════════════════════════════════════════════════
     INFORMACJE
  ═══════════════════════════════════════════════════════════ */

  new SlashCommandBuilder()
    .setName('pomoc')
    .setDescription('Wyświetl centrum komend i możliwości bota'),

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Sprawdź aktualne opóźnienie bota'),


  /* ═══════════════════════════════════════════════════════════
     PROFIL / XP / RANKING
  ═══════════════════════════════════════════════════════════ */

  new SlashCommandBuilder()
    .setName('profil')
    .setDescription('Wyświetl graficzną kartę profilu')
    .addUserOption((o) =>
      o
        .setName('osoba')
        .setDescription('Użytkownik — domyślnie wyświetlany jest Twój profil'),
    ),

  new SlashCommandBuilder()
    .setName('ranga')
    .setDescription('Wyświetl poziom, XP i postęp użytkownika')
    .addUserOption((o) =>
      o
        .setName('osoba')
        .setDescription('Użytkownik — domyślnie wyświetlana jest Twoja ranga'),
    ),

  new SlashCommandBuilder()
    .setName('top')
    .setDescription('Wyświetl ranking najlepszych użytkowników')
    .addStringOption((o) =>
      o
        .setName('typ')
        .setDescription('Wybierz rodzaj rankingu')
        .addChoices(
          {
            name: 'Poziomy / XP',
            value: 'xp',
          },
          {
            name: 'Monety',
            value: 'balance',
          },
        ),
    ),


  /* ═══════════════════════════════════════════════════════════
     EKONOMIA
  ═══════════════════════════════════════════════════════════ */

  new SlashCommandBuilder()
    .setName('portfel')
    .setDescription('Wyświetl graficzną kartę ekonomii')
    .addUserOption((o) =>
      o
        .setName('osoba')
        .setDescription('Użytkownik — domyślnie wyświetlany jest Twój portfel'),
    ),

  new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Odbierz codzienną nagrodę monet — co 24 godziny'),

  new SlashCommandBuilder()
    .setName('praca')
    .setDescription('Pracuj i zarabiaj dodatkowe monety — co 45 minut'),

  new SlashCommandBuilder()
    .setName('przelew')
    .setDescription('Przelej monety innemu użytkownikowi')
    .addUserOption(user)
    .addIntegerOption(amount),

  new SlashCommandBuilder()
    .setName('sklep')
    .setDescription('Wyświetl sklep z przedmiotami i tytułami'),

  new SlashCommandBuilder()
    .setName('kup')
    .setDescription('Kup wybrany przedmiot ze sklepu')
    .addStringOption((o) =>
      o
        .setName('przedmiot')
        .setDescription('Wybierz przedmiot, który chcesz kupić')
        .setRequired(true)
        .addChoices(...choices),
    ),

  new SlashCommandBuilder()
    .setName('plecak')
    .setDescription('Wyświetl swoje zakupione przedmioty'),

  new SlashCommandBuilder()
    .setName('uzyj')
    .setDescription('Aktywuj przedmiot lub ustaw zakupiony tytuł')
    .addStringOption((o) =>
      o
        .setName('przedmiot')
        .setDescription('Wybierz przedmiot znajdujący się w plecaku')
        .setRequired(true)
        .addChoices(...choices),
    ),


  /* ═══════════════════════════════════════════════════════════
     ROZRYWKA
  ═══════════════════════════════════════════════════════════ */

  new SlashCommandBuilder()
    .setName('moneta')
    .setDescription('Rzuć monetą — opcjonalnie zagraj za monety')
    .addStringOption((o) =>
      o
        .setName('strona')
        .setDescription('Wybierz stronę monety')
        .setRequired(true)
        .addChoices(
          {
            name: '🦅 Orzeł',
            value: 'orzel',
          },
          {
            name: '◈ Reszka',
            value: 'reszka',
          },
        ),
    )
    .addIntegerOption((o) =>
      o
        .setName('stawka')
        .setDescription('Opcjonalna stawka od 1 do 100 000 monet')
        .setMinValue(1)
        .setMaxValue(100000),
    ),

  new SlashCommandBuilder()
    .setName('sloty')
    .setDescription('Zagraj na automacie z trzema symbolami')
    .addIntegerOption((o) =>
      o
        .setName('stawka')
        .setDescription('Stawka od 1 do 100 000 monet')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100000),
    ),

  new SlashCommandBuilder()
    .setName('kostka')
    .setDescription('Rzuć kostką posiadającą od 2 do 100 ścian')
    .addIntegerOption((o) =>
      o
        .setName('sciany')
        .setDescription('Liczba ścian — domyślnie 6')
        .setMinValue(2)
        .setMaxValue(100),
    ),

  new SlashCommandBuilder()
    .setName('wrozba')
    .setDescription('Zadaj pytanie magicznej kuli ZERQONA')
    .addStringOption((o) =>
      o
        .setName('pytanie')
        .setDescription('Wpisz swoje pytanie')
        .setRequired(true)
        .setMaxLength(160),
    ),

  new SlashCommandBuilder()
    .setName('kpn')
    .setDescription('Zagraj z botem w kamień, papier, nożyce')
    .addStringOption((o) =>
      o
        .setName('wybor')
        .setDescription('Wybierz swój ruch')
        .setRequired(true)
        .addChoices(
          {
            name: '✊ Kamień',
            value: 'kamien',
          },
          {
            name: '✋ Papier',
            value: 'papier',
          },
          {
            name: '✌️ Nożyce',
            value: 'nozyce',
          },
        ),
    ),

  new SlashCommandBuilder()
    .setName('ankieta')
    .setDescription('Utwórz ankietę zawierającą od 2 do 4 odpowiedzi')
    .addStringOption((o) =>
      o
        .setName('pytanie')
        .setDescription('Temat lub pytanie ankiety')
        .setMaxLength(150)
        .setRequired(true),
    )
    .addStringOption((o) =>
      o
        .setName('opcja1')
        .setDescription('Pierwsza odpowiedź')
        .setMaxLength(80)
        .setRequired(true),
    )
    .addStringOption((o) =>
      o
        .setName('opcja2')
        .setDescription('Druga odpowiedź')
        .setMaxLength(80)
        .setRequired(true),
    )
    .addStringOption((o) =>
      o
        .setName('opcja3')
        .setDescription('Trzecia odpowiedź — opcjonalna')
        .setMaxLength(80),
    )
    .addStringOption((o) =>
      o
        .setName('opcja4')
        .setDescription('Czwarta odpowiedź — opcjonalna')
        .setMaxLength(80),
    ),


  /* ═══════════════════════════════════════════════════════════
     VOICE
  ═══════════════════════════════════════════════════════════ */

  new SlashCommandBuilder()
    .setName('pokoj')
    .setDescription('Otwórz panel zarządzania swoim pokojem głosowym'),


  /* ═══════════════════════════════════════════════════════════
     INFORMACJE O DISCORDZIE
  ═══════════════════════════════════════════════════════════ */

  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Wyświetl szczegółowe informacje o użytkowniku')
    .addUserOption((o) =>
      o
        .setName('osoba')
        .setDescription('Użytkownik — domyślnie wyświetlane są Twoje dane'),
    ),

  new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Wyświetl podstawowe informacje o serwerze'),


  /* ═══════════════════════════════════════════════════════════
     DIAGNOSTYKA
  ═══════════════════════════════════════════════════════════ */

  new SlashCommandBuilder()
    .setName('diagnostyka')
    .setDescription('Szef: sprawdź konfigurację, role, ID i uprawnienia bota'),


  /* ═══════════════════════════════════════════════════════════
     OSTRZEŻENIA
  ═══════════════════════════════════════════════════════════ */

  new SlashCommandBuilder()
    .setName('ostrzezenia')
    .setDescription('Sprawdź swoje ostrzeżenia lub ostrzeżenia użytkownika')
    .addUserOption((o) =>
      o
        .setName('osoba')
        .setDescription('Użytkownik — moderator może sprawdzić inną osobę'),
    ),

  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Helper: nadaj użytkownikowi ostrzeżenie')
    .addUserOption(user)
    .addStringOption(reason),

  new SlashCommandBuilder()
    .setName('unwarn')
    .setDescription('Helper: usuń konkretne ostrzeżenie')
    .addIntegerOption((o) =>
      o
        .setName('numer')
        .setDescription('ID ostrzeżenia do usunięcia')
        .setMinValue(1)
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName('wyczysc')
    .setDescription('Helper: usuń od 1 do 100 ostatnich wiadomości')
    .addIntegerOption((o) =>
      o
        .setName('ilosc')
        .setDescription('Liczba wiadomości do usunięcia')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true),
    ),


  /* ═══════════════════════════════════════════════════════════
     MODERACJA
  ═══════════════════════════════════════════════════════════ */

  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Moderator: nałóż użytkownikowi przerwę do 28 dni')
    .addUserOption(user)
    .addIntegerOption((o) =>
      o
        .setName('minuty')
        .setDescription('Czas przerwy w minutach — od 1 do 40 320')
        .setMinValue(1)
        .setMaxValue(40320)
        .setRequired(true),
    )
    .addStringOption(reason),

  new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Moderator: zakończ aktywną przerwę użytkownika')
    .addUserOption(user)
    .addStringOption(reason),

  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Moderator: wycisz użytkownika przez system Discord')
    .addUserOption(user)
    .addIntegerOption((o) =>
      o
        .setName('minuty')
        .setDescription('Czas wyciszenia w minutach — od 1 do 40 320')
        .setMinValue(1)
        .setMaxValue(40320)
        .setRequired(true),
    )
    .addStringOption(reason),

  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Moderator: zdejmij wyciszenie użytkownika')
    .addUserOption(user)
    .addStringOption(reason),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Moderator: wyrzuć użytkownika z serwera')
    .addUserOption(user)
    .addStringOption(reason),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Moderator: zbanuj użytkownika na serwerze')
    .addUserOption(user)
    .addStringOption(reason),

  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Moderator: zdejmij bana z użytkownika')
    .addStringOption((o) =>
      o
        .setName('id')
        .setDescription('ID użytkownika, którego chcesz odbanować')
        .setRequired(true),
    )
    .addStringOption(reason),

  new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Moderator: ustaw odstęp pomiędzy wiadomościami')
    .addIntegerOption((o) =>
      o
        .setName('sekundy')
        .setDescription('Slowmode od 0 do 21 600 sekund — 0 wyłącza')
        .setMinValue(0)
        .setMaxValue(21600)
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName('zamknij')
    .setDescription('Moderator: zablokuj możliwość pisania na kanale'),

  new SlashCommandBuilder()
    .setName('otworz')
    .setDescription('Moderator: ponownie odblokuj pisanie na kanale'),


  /* ═══════════════════════════════════════════════════════════
     ZARZĄDZANIE ROLAMI
  ═══════════════════════════════════════════════════════════ */

  new SlashCommandBuilder()
    .setName('rola')
    .setDescription('Szef: zarządzaj rolami użytkowników')
    .addSubcommand((s) =>
      s
        .setName('nadaj')
        .setDescription('Nadaj wybraną rolę użytkownikowi')
        .addUserOption(user)
        .addRoleOption((o) =>
          o
            .setName('rola')
            .setDescription('Rola, którą chcesz nadać')
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('zdejmij')
        .setDescription('Zdejmij wybraną rolę użytkownikowi')
        .addUserOption(user)
        .addRoleOption((o) =>
          o
            .setName('rola')
            .setDescription('Rola, którą chcesz zdjąć')
            .setRequired(true),
        ),
    ),


  /* ═══════════════════════════════════════════════════════════
     ZARZĄDZANIE XP
  ═══════════════════════════════════════════════════════════ */

  new SlashCommandBuilder()
    .setName('xp')
    .setDescription('Szef: wykonaj ręczną korektę punktów doświadczenia')
    .addSubcommand((s) =>
      s
        .setName('dodaj')
        .setDescription('Dodaj użytkownikowi określoną ilość XP')
        .addUserOption(user)
        .addIntegerOption(amount),
    )
    .addSubcommand((s) =>
      s
        .setName('odejmij')
        .setDescription('Odejmij użytkownikowi określoną ilość XP')
        .addUserOption(user)
        .addIntegerOption(amount),
    )
    .addSubcommand((s) =>
      s
        .setName('ustaw')
        .setDescription('Ustaw określoną ilość XP użytkownika')
        .addUserOption(user)
        .addIntegerOption(amount),
    ),


  /* ═══════════════════════════════════════════════════════════
     ZARZĄDZANIE EKONOMIĄ
  ═══════════════════════════════════════════════════════════ */

  new SlashCommandBuilder()
    .setName('monety_admin')
    .setDescription('Szef: wykonaj ręczną korektę ekonomii użytkownika')
    .addSubcommand((s) =>
      s
        .setName('dodaj')
        .setDescription('Dodaj użytkownikowi określoną liczbę monet')
        .addUserOption(user)
        .addIntegerOption(amount),
    )
    .addSubcommand((s) =>
      s
        .setName('odejmij')
        .setDescription('Odejmij użytkownikowi określoną liczbę monet')
        .addUserOption(user)
        .addIntegerOption(amount),
    )
    .addSubcommand((s) =>
      s
        .setName('ustaw')
        .setDescription('Ustaw określoną liczbę monet użytkownika')
        .addUserOption(user)
        .addIntegerOption(amount),
    ),
];


/* ─────────────────────────────────────────────────────────────
   DISCORD API PAYLOAD
───────────────────────────────────────────────────────────── */

export const commandPayload = commands.map(
  (command) => command.toJSON(),
);


/* ─────────────────────────────────────────────────────────────
   COMMAND ROUTER
───────────────────────────────────────────────────────────── */

export async function handleCommand(i, store) {

  if (
    !i.inGuild() ||
    i.guildId !== config.guildId
  ) {
    return i.reply({
      content:
        '✦ Ten bot jest skonfigurowany wyłącznie dla serwera **Wymiar ZERQONA**.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (
    await handlePublic(
      i,
      store,
    )
  ) {
    return;
  }

  if (
    await handleAdmin(
      i,
      store,
    )
  ) {
    return;
  }

  await i.reply({
    content:
      '⚠️ Nie rozpoznano tej komendy. Użyj `/pomoc`, aby wyświetlić dostępne możliwości.',
    flags: MessageFlags.Ephemeral,
  });
}
