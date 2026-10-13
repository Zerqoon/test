# Moonlight na Railway

Projekt ma gotowy `Dockerfile`. Railway zbuduje obraz z Node.js, zainstaluje zależności i uruchomi bota. Przy każdym starcie kontenera komendy slash są synchronizowane automatycznie. Nie trzeba wpisywać `npm run deploy` w panelu.

## Uruchomienie

1. Rozpakuj ZIP. Wrzuć **zawartość folderu projektu** do prywatnego repozytorium GitHub: `Dockerfile`, `package.json`, `package-lock.json`, `config.json`, `assets/`, `src/` i `scripts/` muszą być dostępne. Nie wrzucaj `node_modules/`, `.env`, `data/` ani `backups/` — `.gitignore` już je wyklucza.
2. W Railway utwórz projekt i usługę z tego repozytorium. Katalog główny usługi musi wskazywać folder zawierający `Dockerfile`. Railway wykrywa ten plik automatycznie. Pierwszy start przed ustawieniem zmiennych i wolumenu może się nie udać — uzupełnij kolejne kroki, a potem wykonaj **Deploy/Redeploy**.
3. W **Variables** dodaj:

   ```dotenv
   DISCORD_TOKEN=TWÓJ_TOKEN_BOTA
   CLIENT_ID=APPLICATION_ID
   GUILD_ID=ID_SERWERA_DISCORD
   DATABASE_PATH=/app/data/bot.sqlite
   RAILWAY_RUN_UID=0
   ```

   Użyj prawdziwych wartości bez dodatkowych cudzysłowów. `RAILWAY_RUN_UID=0` umożliwia zapis do wolumenu Railway, który jest montowany jako użytkownik root; obraz domyślnie działa jako `node`.

4. Dodaj **Volume** i podłącz go do usługi bota. Ustaw dokładny **Mount Path: `/app/data`**. Tutaj bot zachowuje XP, giveaway, bany czasowe i stan kanałów. Skrypt startowy zatrzyma start na Railway, jeżeli ten wolumen nie jest podłączony pod właściwą ścieżką.
5. W ustawieniach usługi pozostaw **1 replikę w 1 regionie**. Wyłącz **Serverless / usypianie**. Ustaw restart po awarii (**On Failure**, np. 10 prób). Pozostaw puste **Custom Start Command**, **Pre-deploy Command** i **Healthcheck Path** — start obsługuje `Dockerfile`. Bot łączy się z Discordem przez Gateway; nie wymaga publicznej domeny ani portu HTTP.
6. W [Discord Developer Portal](https://discord.com/developers/applications) włącz **Server Members Intent** i **Message Content Intent**. Zaproś bota z zakresami `bot` oraz `applications.commands`, nadaj uprawnienia z `README.md` i ustaw rolę bota powyżej ról, którymi ma zarządzać.
7. Wykonaj **Deploy/Redeploy**. W logach powinno pojawić się `Zarejestrowano ... komend` i `Zalogowano jako ...`. Na Discordzie sprawdź `/konfiguracja`, `/powitanie-test`, `/poziom` i `/regulamin`.

Komendy są rejestrowane podczas startu, gdy wolumen jest już zamontowany. Railway nie udostępnia wolumenów na etapie build ani pre-deploy. Błąd rejestracji zatrzymuje start z komunikatem w logach; sprawdź wtedy token, Application ID, ID serwera i zaproszenie bota.

## Aktualizacje i dane

Aktualizacja 1.1.1 poprawia format nowych logów oraz zapis edycji i usunięć. Wgraj cały projekt z ZIP-a do dotychczasowego repozytorium i wykonaj Redeploy. Nie zmieniaj Variables ani Volume. Nowe formatowanie pojawi się przy kolejnych zdarzeniach; istniejące wpisy na Discordzie pozostają w starej formie.

W wersji 1.1 wgraj do repozytorium cały nowy kod wraz z `config.json`: zawiera welcome `1559306598927704135` oraz właściciela `1488470377993736234` w `ownerIds`. Zachowaj dotychczasowe Variables i podłączony Volume `/app/data`. Po Redeploy komendy zarejestrują się automatycznie — będzie ich 28. Sprawdź `/uprawnienia`, które powinno pokazać „Właściciel bota — dostęp po ID”. Dla nowych `/kick` i `/nick` dodaj botowi uprawnienia Kick Members i Manage Nicknames. Baza danych rozszerzy swój schemat automatycznie, bez kasowania wyników.

Zmiany kodu lub `config.json` wysyłaj do tego samego repozytorium i wdrażaj w tej samej usłudze z tym samym wolumenem. Nie uruchamiaj równolegle drugiej kopii bota z tym samym tokenem. Zachowaj wolumen podczas aktualizacji; włącz jego kopie zapasowe w Railway. Lokalny folder `backups/` projektu znajduje się poza wolumenem, więc na Railway nie jest trwałym magazynem kopii.

Jeśli bot działał już lokalnie i chcesz przenieść jego wyniki, zatrzymaj lokalną instancję, wykonaj `npm run backup`, a uzyskaną spójną kopię bazy wgraj jako `/app/data/bot.sqlite` przed pierwszym startem na Railway. Nie kopiuj samej otwartej bazy bez plików WAL ani nie nadpisuj działającej bazy. Bez migracji pierwsze uruchomienie zacznie z pustymi statystykami.

Nie uruchamiaj procesu jako Cron Job. Bot potrzebuje stale działającej usługi; koszty i dostępne zasoby zależą od Twojego planu Railway. Ta paczka została sprawdzona lokalnie; wdrożenie na Twoim koncie i połączenie z serwerem Discord wymagają Twoich danych.

Źródła: [Dockerfile w Railway](https://docs.railway.com/builds/dockerfiles), [wolumeny i ich uprawnienia](https://docs.railway.com/volumes), [komenda startowa](https://docs.railway.com/deployments/start-command), [Serverless](https://docs.railway.com/deployments/serverless).
