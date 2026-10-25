# WIDMO — profesjonalny bot Discord

Bot Discord w czarno-białej identyfikacji WIDMO. Projekt zawiera moderację, logowanie zdarzeń, poziomy XP, karty Canvas, automatyczne role, tickety, sugestie, giveaway i tymczasowe kanały głosowe. Nie tworzy automatycznie dodatkowych ról administracyjnych ani kategorii na serwerze — używa istniejących ID z konfiguracji.

## Funkcje

- **Powitania z Canvasem** — karta 1600 × 780 z avatarem, nazwą użytkownika, datą utworzenia konta, datą dołączenia i liczbą członków. Gdy Canvas nie uda się wygenerować, bot nadal wysyła zwykły embed powitalny.
- **Poziomy XP** — XP za wiadomości i aktywność na voice, ochrona przed prostym spamem, karta profilu, awans, TOP 10, kolejka nagród ról oraz stały panel interaktywny. `/panel` edytuje zapisaną wiadomość zamiast tworzyć duplikat.
- **Canvas poziomów** — osobne grafiki dla panelu, profilu, awansu i rankingu. Dockerfile instaluje fontconfig oraz DejaVu Sans, aby tekst nie znikał na obrazie Railway. Po zmianie wersji można wygenerować podglądy przez `npm run preview`.
- **Moderacja** — timeout/unmute, ban/unban, kick, clear, slowmode, warny, automod oraz kontrole uprawnień aktora i celu.
- **Logi** — edycje i usunięcia wiadomości, wiadomości zawierające linki/GIF-y, wejścia i wyjścia członków (avatar, ID, daty konta), voice, zmiany ról/nicków/timeoutów, zdarzenia z Audit Log oraz wywołania komend slash.
- **Tickety** — panel w kanale `1563956514417414315` z dwoma przyciskami: `Clan PS99` i `Pomoc ogólna`. Prywatne kanały tworzą się w kategorii `1563987770391924777`. Każdy ticket ma limit, przycisk zamknięcia, potwierdzenie i transkrypt TXT wysyłany do logów przed usunięciem kanału.
- **Sugestie** — `/propozycja` publikuje pomysł w kanale `1563957007126626384`; głosy „Popieram”/„Nie popieram” są przechowywane w SQLite i jeden użytkownik może zmienić swój głos.
- **Automatyczne role** — trzy ID w `roles.auto` są nadawane nowym osobom oraz uzupełniane istniejącym członkom po starcie. Wymaga to `Server Members Intent`, `Manage Roles` i odpowiedniej hierarchii roli bota.
- **Prywatne kanały głosowe** — użytkownik musi pozostawać na kanale startowym przez 5 sekund, aby otrzymać pokój i panel sterowania. Pusty kanał zostaje usunięty po 5 sekundach; powrót osoby anuluje odliczanie.
- **Giveaway**, edytor embedów, pomoc, diagnostyka i informacje o użytkownikach/serwerze.

## Kanały skonfigurowane dla serwera

| Funkcja | ID |
|---|---:|
| Powitania | `1559306598927704135` |
| Informacje/panel poziomów | `1559306736433766500` |
| Start automatycznego voice | `1516765981244915825` |
| Edycje/usunięcia/linki/GIF-y | `1517117542223839353` |
| Wejścia/wyjścia i tworzenie/usuwanie voice | `1517117569566507029` |
| Dołączenie/wyjście z serwera, avatar i daty konta | `1517117609617915934` |
| Komendy slash, zmiany ról/kanałów i logi administracyjne | `1517117642794602516` |
| Panel ticketów | `1563956514417414315` |
| Kategoria ticketów | `1563987770391924777` |
| Sugestie | `1563957007126626384` |

## Istniejące role — bot niczego nie tworzy

| Funkcja | ID |
|---|---:|
| Owner (istniejąca rola) | `1515440522225913926` |
| Admin | `1563993794536284190` |
| Moderator | `1516499895434088508` |
| Booster | `1515748354426933269` |
| Weteran | `1517165022151704626` |
| Właściciel bota — dostęp po ID użytkownika, bez roli | `1488470377993736234` |
| Autorole 1 | `1517118754037698631` |
| Autorole 2 | `1516502263944839359` |
| Autorole 3 | `1516502180759212112` |

Nie ma roli Helper ani dodatkowej roli „Owner serwera” tworzonej przez bota. `roles.owner` wskazuje istniejącą rolę Owner; `ownerIds` to oddzielna lista kont mających dostęp właściciela bota.

## Instalacja lokalna

Wymagany jest Node.js `22.18+`.

```sh
cp .env.example .env
# Uzupełnij DISCORD_TOKEN, CLIENT_ID i GUILD_ID
npm ci
npm run check
npm test
npm run deploy
npm start
```

Na Windows skopiuj `.env.example` jako `.env` ręcznie, jeśli nie używasz powłoki obsługującej `cp`.

## Railway

1. Wgraj **zawartość** ZIP-a do głównego katalogu repozytorium — `Dockerfile`, `railway.json`, `package.json`, `package-lock.json`, `config.json`, `src/`, `scripts/` i `assets/` muszą leżeć w katalogu głównym.
2. Ustaw Builder na **Dockerfile** (nie Railpack) lub skorzystaj z dołączonego `railway.json` w obsługiwanej, istniejącej usłudze. W logach buildu ma pojawić się `Using detected Dockerfile!`.
3. Dodaj zmienne:

   ```dotenv
   DISCORD_TOKEN=TWÓJ_TOKEN_BOTA
   CLIENT_ID=APPLICATION_ID
   GUILD_ID=ID_SERWERA
   DATABASE_PATH=/app/data/bot.sqlite
   ```

   `OWNER_IDS` jest opcjonalne. W `config.json` jest już ustawione ID `1488470377993736234`; pozostaw `OWNER_IDS` puste, aby użyć tej wartości, albo podaj listę kont oddzielonych przecinkami.

4. Dodaj **Volume** z `Mount Path` ustawionym na `/app/data`. SQLite i trwałe identyfikatory paneli są przechowywane właśnie tam. Używaj jednej repliki, aby nie uruchomić dwóch botów na tej samej bazie.
5. W Discord Developer Portal włącz `Server Members Intent` i `Message Content Intent`. Nadaj botowi m.in. View Channel, Send Messages, Embed Links, Attach Files, Read Message History, Manage Messages, Manage Roles, Manage Channels, Connect, Move Members, Moderate Members, Ban Members, Kick Members i View Audit Log. Rola bota musi znajdować się nad rolami, którymi zarządza.
6. Po deployu bot automatycznie aktualizuje jeden panel poziomów i jeden panel ticketów. Uruchom `/widmo-setup`, aby zobaczyć raport ID/uprawnień i ponownie zsynchronizować panele; ta komenda **nie tworzy kanałów ani ról**. Użyj `/konfiguracja` i `/powitanie-test`, aby sprawdzić działanie.

## Najważniejsze komendy

| Komenda | Działanie |
|---|---|
| `/pomoc` | Lista dostępnych komend |
| `/poziom [uzytkownik]` | Karta XP/profilu |
| `/ranking` | Graficzny TOP 10 |
| `/panel` | Odświeżenie panelu poziomów |
| `/ticket-panel [kanal]` | Publikacja/aktualizacja panelu ticketów |
| `/propozycja pomysl` | Publikacja sugestii |
| `/widmo-setup` | Diagnostyka ID/uprawnień i synchronizacja paneli |
| `/konfiguracja` | Pełny raport diagnostyczny |
| `/powitanie-test` | Prywatny podgląd Canvas powitania |
| `/regulamin` | Publikacja regulaminu — ustaw `channels.rules`, jeśli używasz tej funkcji |

Pozostałe komendy obejmują moderację, giveaway, XP, informacje o użytkownikach/serwerze, embed i prywatne pokoje głosowe.

## Testy i diagnostyka

```sh
npm run check
npm test
npm run preview
```

`npm run preview` zapisuje karty PNG w `preview/`. Jeśli obraz na Railway nadal jest bez tekstu, sprawdź, czy build rzeczywiście używa Dockerfile i czy log zawiera `[Canvas] Font kart: WIDMO Sans` (lub `Manrope`). Nie używaj Railpack dla tej wersji, ponieważ wtedy instalacja fontów z Dockerfile się nie wykona.

Bot nie jest wstępnie zalogowany do Twojego serwera; token nie jest częścią ZIP-a i nie powinien być publikowany.
