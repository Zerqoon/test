# R3V0 Community Bot

Kompletny bot Discord dla wskazanego serwera: karty PNG, poziomy za tekst i rozmowy głosowe, ekonomia, pokoje tymczasowe, 40 komend i cztery kanały logów. Kod jest po polsku w komunikatach, uruchamia się na Node.js 24 i zapisuje SQLite na dysku Railway.

## Uruchomienie na Railway

1. Utwórz aplikację bota w [Discord Developer Portal](https://discord.com/developers/applications). W zakładce **Bot → Privileged Gateway Intents** włącz **Server Members Intent** i **Message Content Intent**. Token trzymaj wyłącznie w zmiennej środowiskowej.
2. Zaproś bota z zakresami `bot` i `applications.commands`. Nadaj mu uprawnienia: **View Channels, Send Messages, Embed Links, Attach Files, Read Message History, Add Reactions, Manage Channels, Move Members, Manage Roles, Moderate Members, Kick Members, Ban Members, Manage Messages, View Audit Log, Connect**. Umieść jego rolę **Arcymistrz** (`1516499741368647690`) **ponad rolami poziomowymi i osobami, którymi ma zarządzać**. Same uprawnienia administratora nie rozwiązują hierarchii ról.
3. Umieść projekt w repozytorium i połącz repozytorium z Railway. Railway automatycznie wykryje `Dockerfile` w katalogu głównym; bot uruchamia się z `npm start`. W Railway dodaj zmienne `DISCORD_TOKEN`, `GUILD_ID`; `CLIENT_ID` jest potrzebne tylko do ręcznej komendy `npm run deploy`. `GUILD_ID` to **ID całego serwera**, nie kanału. Przykład w `.env.example`.
4. **Dodaj Railway Volume do tej usługi i zamontuj go pod `/data`.** Railway sam przekazuje `RAILWAY_VOLUME_MOUNT_PATH`; bot automatycznie zapisze `/data/community.sqlite`. Uruchomienie na Railway bez Volume celowo kończy się błędem, aby nie zgubić ekonomii i poziomów. Nie ustawiaj `DATA_DIR` na folder repozytorium w usłudze Railway. Użyj jednej instancji bota i jednego woluminu.
5. Uruchom usługę. Podczas startu bot rejestruje 40 komend bez osobnej komendy deploy. Na serwerze użyj `/diagnostyka` jako Szef i popraw czerwone pozycje. Kanały logów muszą być kanałami tekstowymi; lobby musi być kanałem głosowym. Włącz **Developer Mode**, by sprawdzić ID w razie potrzeby.

Oficjalne źródła: [Discord — intenty Gateway](https://docs.discord.com/developers/events/gateway#privileged-intents), [Discord — log audytowy](https://docs.discord.com/developers/resources/audit-log), [Railway — Volumes](https://docs.railway.com/volumes).

## Lokalny start

```bash
cp .env.example .env
# Uzupełnij .env: token, ID serwera, ID aplikacji.
npm ci
npm start
```

Komendy synchronizują się przy starcie. Możesz też zarejestrować je ręcznie: `npm run deploy`. `npm test` sprawdza bazę, nagrody i poziomy. `npm run preview` tworzy przykładowe obrazy w katalogu `previews/`. Nie publikuj pliku `.env` ani bazy. Wykonuj kopie zapasowe Volume w Railway; SQLite jest pojedynczym plikiem z zapisem WAL.

## Ustawione kanały

| Funkcja | ID |
| --- | --- |
| Ogłoszenia o awansach | `1516768963814490179` |
| Lobby: dołącz, aby utworzyć pokój | `1516765981244915825` |
| Edycje/usunięcia wiadomości | `1517117542223839353` |
| Przejścia między kanałami głosowymi | `1517117569566507029` |
| Konta i nazwy | `1517117609617915934` |
| Role, przerwy, wyrzucenia, bany, kanały i działania ekipy | `1517117642794602516` |

Wszystkie ID i reguły można zmienić w `src/config.js`. Kanał `1516768963814490179` służy **ogłoszeniom o poziomach**. XP za tekst działa domyślnie na całym serwerze. Jeśli XP ma wpadać tylko w wybranych kanałach, ustaw `XP_CHANNEL_IDS=id1,id2`. Podobnie `VC_XP_CHANNEL_IDS=id1,id2` ogranicza XP głosowe.

## Role

| Dostęp | Rola | ID |
| --- | --- | --- |
| Szef | Szef nad wszystkimi | `1515440522225913926` |
| Rola przypisywana botowi | Arcymistrz | `1516499741368647690` |
| Moderator | Namiestnik | `1516499895434088508` |
| Helper | Strażnik | `1526998317014323221` |
| Premia 2× XP z wiadomości i VC | Booster | `1515748354426933269` |

| Poziom | Nadawana najwyższa rola | ID |
| ---: | --- | --- |
| 5 | Nowicjusz | `1516500127433621504` |
| 10 | Adept | `1516502881115836528` |
| **20** | **Wędrowiec** | `1516499892154007562` |
| 30 | Strażnik | `1516503624946286754` |
| 40 | Czempion | `1516503622337171456` |
| 50 | WszechMistrz | `1516503826599903384` |

Próg Wędrowca nie został podany, dlatego ustawiono 20. poziom. Bot nadaje **najwyższą osiągniętą rolę** i usuwa wcześniejszą. „Strażnik” jako Helper i jako poziom 30 mają różne ID, więc uprawnienia moderatora wynikają tylko z ID Helpera. Rola bota nie nadaje uprawnień graczom.

## Systemy i komendy

**XP:** 12–18 XP za wiadomość z przynajmniej trzema znakami; 45 sekund odstępu i blokada powtórzenia ostatniej treści przez pięć minut. VC: 8 XP/minutę, jeśli w kanale są minimum dwie osoby niebędące botami i nieogłuszone. Lobby i kanał AFK nie dają XP. Booster daje 2×; sklepowe +50% sumuje się z Boosterem (łącznie 3×). Za awans są monety w wysokości `75 × nowy poziom`. Poziom wynika z sumy `60 × poziom + 35 × poziom²`.

**Profile:** `/profil`, `/ranga`, `/top [poziomy|monety]`, `/portfel`, `/userinfo`, `/serverinfo`, `/ping`, `/pomoc`. Karty są generowane jako PNG z awatarem, a przykłady znajdują się w `previews/`.

**Ekonomia:** `/daily` (350 monet co 24 godziny), `/praca` (100–240 co 45 minut), `/przelew`, `/sklep`, `/kup`, `/plecak`, `/uzyj`. Sklep ma godzinny bonus XP i tytuły widoczne na profilu. Transakcje są wykonywane atomowo w SQLite.

**Zabawy:** `/moneta` (stawka opcjonalna), `/sloty` (para 1,5×, trzy identyczne 5×, trzy diamenty 8×), `/kostka`, `/wrozba`, `/kpn`, `/ankieta`.

**Pokój:** po dołączeniu do lobby bot tworzy kanał pod jego kategorią, przenosi użytkownika i wysyła panel do czatu w nowym kanale głosowym. Panel i `/pokoj` obsługują nazwę, limit, zamknięcie, ukrycie, dodawanie, blokadę, odblokowanie, odłączanie, przekazanie własności, przejęcie nieobecnego właściciela i potwierdzone usunięcie. Pusty kanał znika po 30 sekundach; po restarcie bot ponownie sprawdza zapisane pokoje. Do sterowania potrzebny jest właściciel lub moderator.

**Administracja:** `/ostrzezenia` (własne lub cudze dla ekipy); Helper: `/warn`, `/unwarn`, `/wyczysc`; Moderator: `/mute`, `/unmute`, `/timeout`, `/untimeout`, `/kick`, `/ban`, `/unban`, `/slowmode`, `/zamknij`, `/otworz`; Szef: `/rola`, `/xp`, `/monety_admin`, `/diagnostyka`. Właściciel serwera ma poziom Szefa. Komendy sprawdzają także hierarchię ról użytkownika i bota. Bot nigdy nie traktuje samej roli „Arcymistrz” jako uprawnień członka ekipy.

## Dokładność logów

Bot przechowuje lokalnie treść ostatnich wiadomości, aby przy usuwaniu/edycji pokazać poprzednią treść; snapshoty są usuwane po siedmiu dniach. Jeśli wiadomość nie była widziana przez bota, wcześniejsza treść jest niedostępna. Przy usunięciu Discord nie zawsze wskazuje osobę: bot przypisuje sprawcę wyłącznie przy świeżym, pasującym wpisie audytu. W innym przypadku pisze „nieustalone”. Globalne zmiany awatara/nazwy są widoczne wtedy, gdy Discord dostarczy zdarzenie dla użytkownika znajdującego się w pamięci bota. Wpisy audytu dla zmian ról, kanałów, banów i timeoutów pokazują wykonawcę, jeśli bot ma **View Audit Log**. Czas w Discordzie wyświetla się w strefie osoby czytającej.

## Pliki

`src/index.js` — start i zdarzenia · `src/config.js` — ID i stawki · `src/db.js` — SQLite · `src/cards.js` — grafiki · `src/voice.js` — kanały tymczasowe · `src/experience.js` — XP i role · `src/logs.js` — logowanie · `src/commands*.js` — komendy · `assets/fonts/` — czcionki i licencja.
