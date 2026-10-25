# WIDMO — wdrożenie Railway

## Build

1. W GitHub umieść zawartość projektu bezpośrednio w katalogu głównym repozytorium.
2. Ustaw Build Builder na **Dockerfile**. `Dockerfile` instaluje `fontconfig`, `fonts-dejavu-core` i `gosu`; Canvas jawnie rejestruje czcionki WIDMO. Build wykonuje `npm run check` oraz `npm test`, w tym kontrolę rzeczywiście narysowanych pikseli tekstu. Jeśli te testy nie przejdą, build zostanie zatrzymany przed deploymentem. Plik `railway.json` przypina builder do Dockerfile dla istniejących usług obsługujących Config as Code. Jeśli dashboard nadal pokazuje Railpack, wybierz Dockerfile w ustawieniach Build.
3. Log musi zawierać `Using detected Dockerfile!`.

## Variables

```dotenv
DISCORD_TOKEN=TWÓJ_TOKEN_BOTA
CLIENT_ID=APPLICATION_ID
GUILD_ID=ID_SERWERA
DATABASE_PATH=/app/data/bot.sqlite
```

`OWNER_IDS` jest opcjonalne. Domyślne konto właściciela bota ustawione w `config.json`: `1488470377993736234`.

## Storage

Dodaj trwały Volume z Mount Path `/app/data`. Nie zmieniaj ścieżki `DATABASE_PATH`. Używaj jednej repliki — SQLite nie jest współdzieloną bazą dla wielu replik.

## Intents i uprawnienia

W Developer Portal włącz `Server Members Intent` i `Message Content Intent`. Bot wymaga `View Channel`, `Send Messages`, `Embed Links`, `Attach Files`, `Read Message History`, `Manage Messages`, `Manage Roles`, `Manage Channels`, `Connect`, `Move Members`, `Moderate Members`, `Ban Members`, `Kick Members` oraz `View Audit Log` do pełnej funkcjonalności. Umieść rolę bota wyżej niż role, które nadaje.

## Po pierwszym deployu

- W logach znajdź `WIDMO online` oraz `[Canvas] Font kart: ...`.
- Użyj `/widmo-setup` — sprawdza ID i uprawnienia oraz odświeża panel poziomów i ticketów. **Nie tworzy ról/kategorii/kanałów**.
- Użyj `/konfiguracja` do sprawdzenia uprawnień oraz `/powitanie-test` do kontroli karty Canvas.
- Sprawdź kanał poziomów `1559306736433766500`, panel ticketów `1563956514417414315`, kategorię ticketów `1563987770391924777` i sugestie `1563957007126626384`.
- W panelu ticketów testuj obie opcje: `Clan PS99` oraz `Pomoc ogólna`.
- Sprawdź, czy trzy role z `roles.auto` trafiają do nowych członków i czy istniejący członkowie otrzymują brakujące role. Nagrody XP skonfiguruj komendą `/nagrody-poziomu ustaw`; następnie `/nagrody-poziomu lista` pokaże aktywne progi. Wymaga to dostępu do listy członków i właściwej hierarchii ról.

## Naprawa typowych błędów

- **Railpack process exited** — Builder wskazuje Railpack albo katalog główny usługi nie zawiera `Dockerfile`; popraw Build Builder/Root Directory.
- **Canvas bez tekstu** — upewnij się, że budujesz Dockerfile, a nie Railpack. Dockerfile instaluje i rejestruje systemowe fonty; smoke test Canvas sprawdza, czy tekst jest widoczny w wygenerowanym PNG.
- **Brak kanału/roli** — upewnij się, że ID należy do tego serwera oraz bot ma dostęp do kanału/roli.
- **Nie działa autorole** — sprawdź `Manage Roles`, hierarchię ról i oba wymagane intenty.
- **Nie da się tworzyć ticketów** — kategoria `1563987770391924777` musi być kategorią, a bot potrzebuje `Manage Channels` i dostępu do niej.
- **Panel poziomów ma stare przyciski** — użyj `/panel`; bot edytuje zapisaną wiadomość, nadpisując stare komponenty nowymi poprawnymi emoji.

Nie publikuj tokenu, `.env`, bazy SQLite ani transkryptów ticketów.

## WIDMO 4.0: role za poziomy

- `/nagrody-poziomu lista` pokazuje aktywne progi.
- `/nagrody-poziomu ustaw poziom rola` ustawia rolę nagrody; rola musi istnieć, być niżej niż rola bota i nie mieć uprawnień Administrator/Manage Server/Manage Roles.
- `/nagrody-poziomu usun poziom` usuwa próg i uruchamia synchronizację, która usuwa nieaktualne role poziomów u zapisanych członków.
- Role nagród są zapisywane w SQLite na wolumenie; nie dopisuj ich ręcznie do `config.json`.
- Ticket może zostać przejęty przez moderatora; dane przypisania są przechowywane w SQLite. Przy starcie otwarte rekordy są sprawdzane względem istniejących kanałów.
- Kopię bazy tworzy `npm run backup`; plik zostaje w `/app/data/backups`, a nie w nietrwałym katalogu projektu. Retencja domyślnie zachowuje maksymalnie 20 plików z ostatnich 14 dni; ustaw `BACKUP_RETENTION_COUNT` i `BACKUP_RETENTION_DAYS`, aby zmienić te limity.


## Aktualizacja 4.0.3 — testy i baza
- Aktualizacja inicjalizuje `widmo_tickets` bezpośrednio w module bazy, co eliminuje zależność AutoMod od kolejności importów.
- Testy uprawnień są zsynchronizowane z konfiguracją bez roli Helper; komunikaty używają nazw Admin i Owner.
- Po deployu sprawdź log builda: `npm run check` i `npm test` muszą zakończyć się kodem 0.


## Build z poprawkami 4.0.3
W tej wersji poprawiono pięć testów/regresji zgłoszonych w logu Railway. Po pushu uruchom nowy deploy i sprawdź, czy `npm run check` oraz `npm test` kończą się kodem 0. Jeśli któryś test nadal zawiedzie, zachowaj nazwę testu i jego stack trace — nie pomijaj testów, aby wymusić build.

## Gdy build nadal kończy się na `npm test`

1. Wersja 4.0.3 jest historyczna. Dla aktualnej wersji 4.0.4 wgraj nowy ZIP bezpośrednio do głównego katalogu repozytorium; log buildu powinien zawierać `[test] WIDMO 4.0.4 — deterministic isolated fixture`.
2. Sprawdź, czy Build → Root Directory wskazuje katalog, w którym leżą `Dockerfile`, `package.json`, `package-lock.json`, `src/` i `test/`.
3. Jeśli błąd pozostaje, skopiuj pierwsze bloki `not ok` i ich `error:` z logu powyżej `npm test`; sam wiersz `exit code: 1` jest tylko podsumowaniem.

Test runner wymusza stałe ID testowego serwera i właściciela, żeby środowisko produkcyjne Railway nie wpływało na asercje.


## Aktualizacja 4.0.4 — AutoMod
Błąd `Provided value cannot be bound to SQLite parameter 2` występował, gdy testowy/częściowy obiekt wiadomości nie miał `channelId`. AutoMod teraz pomija wyszukanie ticketu, gdy ID kanału jest nieobecne. Sprawdź w logu nowy znacznik `[test] WIDMO 4.0.4 — deterministic isolated fixture`.
