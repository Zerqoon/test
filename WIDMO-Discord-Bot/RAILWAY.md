# WIDMO na Railway — instrukcja wdrożenia

1. Wgraj zawartość folderu projektu do repozytorium GitHub. `Dockerfile`, `package.json`, `package-lock.json`, `config.json`, `assets/`, `src/` i `scripts/` muszą być w katalogu głównym usługi.
2. Utwórz usługę Railway z tego repozytorium. Railway wykryje `Dockerfile`.
3. W **Variables** ustaw:

   ```dotenv
   DISCORD_TOKEN=TOKEN_BOTA
   CLIENT_ID=APPLICATION_ID
   GUILD_ID=ID_SERWERA
   DATABASE_PATH=/app/data/bot.sqlite
   OWNER_IDS=
   ```

   `OWNER_IDS` jest opcjonalne. Wpisz tam ID zaufanego konta/kont, rozdzielając je przecinkami. Nie wpisuj tokenu do kodu ani GitHuba.
4. Dodaj trwały **Volume** i ustaw **Mount Path** na `/app/data`. Nie zmieniaj tej ścieżki — start jest celowo zatrzymywany, jeśli Railway uruchamia kontener bez oczekiwanego wolumenu.
5. Ustaw jedną replikę oraz restart usługi po awarii. Nie używaj Cron Job ani usypiania serverless; bot musi stale utrzymywać połączenie Gateway z Discordem. Żaden publiczny port nie jest potrzebny.
6. W Developer Portal włącz **Server Members Intent** i **Message Content Intent**. Bot wymaga też uprawnień Manage Channels oraz Manage Roles dla kreatora, a także uprawnień określonych w README.
7. Deploy. Podałeś już jawne ID kanałów w `config.json`; bot ich użyje bez przenoszenia i bez zmiany istniejących uprawnień. Możesz uruchomić `/widmo-setup` jako Administrator, aby uzupełnić brakujące elementy. Sprawdź `/konfiguracja` i `/powitanie-test`; bot sam przypnie kartę info o poziomach w kanale poziomów.
8. Testuj `/propozycja` na koncie członkowskim. Sprawdź utworzenie prywatnego ticketu, dostęp autora/kadry i czy po zamknięciu transkrypt trafia do prywatnego `☠・logi-moderacji`.

## Aktualizacja

Wgrywaj nowy kod do tej samej usługi i zachowuj wolumen `/app/data`. Jawne, niepuste ID kanałów i role automatyczne z `config.json` mają pierwszeństwo przed starymi mapowaniami SQLite; pozostałe elementy kreatora są zapisywane per serwer. Ponowne użycie komendy uzupełnia brakujące kanały i role; nie kasuje niczego ani nie zmienia uprawnień istniejących ról. ID konfiguracji kreatora są przechowywane pod kluczem bieżącego serwera. Samodzielne role z przycisków muszą mieć zerowe uprawnienia.

Jeśli deploy się nie uruchamia, odczytaj pierwszą konkretną przyczynę z logów. Najczęstsze to błędny token/Application ID/ID serwera, brak intentów, brak Volume lub brak Manage Channels/Manage Roles. Nie uruchamiaj drugiej repliki bota korzystającej z tej samej bazy.
