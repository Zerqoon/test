# Wymiar ZERQONA — Community Bot v4.0

Profesjonalny bot Discord dla community: leveling, ekonomia, publiczne karty wypłat, sklep z czasowymi boostami, kolekcja kosmetyków, bank, osiągnięcia, pokoje głosowe, moderacja i logi. Interfejs Canvas został przebudowany na czarno-biało-fioletowy, rysunkowy styl zamiast generycznych „gamingowych kryształów”.

## Najważniejsze cechy v4

- **Publiczne wypłaty Canvas:** `/praca`, `/daily`, `/weekly`.
- **Publiczny dashboard ekonomii:** `/ekonomia` i `/nagrody` z opcją `prywatnie:true`.
- **Tylko czasowe boosty:** 1 h / 3 h / 6 h / 12 h; brak permanentnych boostów statystyk.
- **Kosmetyki na stałe:** tytuły, motywy i ramki są kolekcjonerskie i nie zwiększają statystyk.
- **Własne ikony Canvas:** moneta, teczka, zegar, korona, torba, tarcza, puchar i inne są rysowane w kodzie.
- **Czyszczenie slash commandów:** `/komendy` oraz skrypty `deploy:clean`, `commands:status`, `commands:clear`.
- **Bez resetowania danych:** zachowane są stare ID przedmiotów i kompatybilność z istniejącą bazą SQLite.
- **Uprawnienia:** nieupoważniona osoba dostaje publiczny komunikat z oznaczeniem i wymaganym poziomem dostępu.

## Instalacja

Wymagany Node.js **22.16+**.

```bash
npm ci
cp .env.example .env
npm run deploy:clean
npm start
```

Na Windows możesz skopiować `.env.example` ręcznie i użyć `START_WINDOWS.bat` po instalacji zależności.

Minimalny `.env`:

```env
DISCORD_TOKEN=...
CLIENT_ID=...
GUILD_ID=...
DATA_DIR=./data
```

Na Railway używaj stałego Volume dla bazy. Nie uruchamiaj dwóch instancji korzystających z tego samego pliku SQLite jednocześnie.

## Slash commands bez „NIEZNANA KOMENDA”

Discord przechowuje listę komend po swojej stronie. Samo usunięcie handlera z kodu nie usuwa starej komendy z interfejsu. v4 używa bulk overwrite dla komend serwerowych oraz potrafi wyczyścić stare komendy globalne.

```bash
npm run deploy          # synchronizuj bieżące komendy serwera
npm run deploy:clean    # usuń globalne stare komendy + synchronizuj serwer
npm run commands:status # porównaj projekt z Discordem
npm run commands:clear  # usuń wszystkie komendy globalne i serwerowe
```

Na Discordzie odpowiednikiem są `/komendy status`, `/komendy synchronizuj` i `/komendy wyczysc_stare` dla roli Szefa.

## Ekonomia

`/daily` wypłaca nagrodę raz na 24 h z serią do 7 odbiorów. `/praca` ma cooldown 45 minut, a `/weekly` 7 dni. Po sukcesie bot publikuje kartę wypłaty z awatarem, kwotą, bonusem, saldem i terminem kolejnego odbioru. Cooldown odpowiada prywatnie.

Boosty sklepu:

- **Podwójna kawa** — 1,5× XP przez 1 h;
- **Nocny maraton** — 1,5× XP przez 6 h;
- **Tryb turbo** — 2× XP przez 1 h;
- **Nadgodziny** — 1,5× `/praca` przez 3 h;
- **Zmiana premium** — 1,5× `/praca` przez 12 h.

Ta sama moc może przedłużać czas. Inny mnożnik tego samego efektu nie nadpisuje aktywnego boosta. Rola Booster może działać dodatkowo zgodnie z konfiguracją serwera.

Sklep używa `ZC`. Tytuły, motywy i ramki nie są boostami i zostają w kolekcji po zakupie.

## Leveling

Wiadomości dają 12–18 XP z cooldownem 45 s i ochroną przed powtarzaniem treści. Aktywne VC daje 8 XP/min, gdy spełnione są warunki konfiguracji. Role poziomowe są przypisane w `src/config.js`.

Naturalny awans wypłaca bonus monet. Administracyjna korekta `/xp` nie generuje nagrody za awans.

## Moderacja i zarządzanie

Helper obsługuje ostrzeżenia i czyszczenie. Moderator ma timeout/kick/ban i operacje kanałowe. Szef ma role, korekty XP/monet, diagnostykę i zarządzanie slash commandami. Dodatkowo obowiązuje hierarchia ról Discorda i rzeczywiste uprawnienia bota.

`/zamknij` zapisuje poprzedni stan `SendMessages` dla `@everyone`; `/otworz` go odtwarza zamiast zgadywać poprzednie ustawienie.

## Sprawdzenie projektu

```bash
npm run check
npm test
npm run verify
npm run preview
npm run docs
```

`npm run preview` generuje 17 przykładowych kart w `previews/`, w tym karty wypłat dla pracy, daily i weekly.

## Struktura

- `src/graphics.js` — system rysowania, motywy, doodle icons;
- `src/cards.js` — karty profilu, ekonomii, sklepu, osiągnięć i wypłat;
- `src/shop.js` — katalog czasowych boostów i kosmetyków;
- `src/command-manager.js` — status/synchronizacja/czyszczenie slash commandów;
- `src/commands*.js` — komendy publiczne i administracyjne;
- `src/db.js` — SQLite i migracje;
- `src/experience.js` — leveling;
- `src/voice.js` — pokoje głosowe;
- `src/logs.js` — logi;
- `tests/` — testy regresji i logiki;
- `previews/` — wygenerowane podglądy kart.

Pełny katalog poleceń generuje `npm run docs` do `KOMENDY.md`. Szczegóły zmian: `ZMIANY-v4.md`.
