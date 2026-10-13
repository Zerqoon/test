# 🌙 Moonlight — Twój bot Discord

Gotowy projekt w języku polskim. Nazwa „MOONLIGHT” jest nazwą roboczą: zmień `serverName` w `config.json`. Wszystkie przesłane ID kanałów i ról są już wpisane. Oryginalne tło jest w `assets/background.png`.

**Hosting Railway:** gotowy Dockerfile i instrukcja krok po kroku są w [RAILWAY.md](RAILWAY.md). Wymagane są zmienne bota oraz trwały wolumen `/app/data`.

**Aktualizacja 1.1.1 — czytelne logi:** audyt ma polskie nazwy zdarzeń, wykonawcę, cel, powód i osobne pola zmian „Przed” / „Po”. Role i uprawnienia są opisane nazwami zamiast surowego JSON. Długie wpisy mieszczą się w limitach embeda, a pełne szczegóły trafiają do załącznika TXT. Naprawiono pomijanie szybkich edycji i kolejność zapisu przy zbiorczym usuwaniu wiadomości. Tekst użytkownika, w tym jego nawiasy, pozostaje zachowany. Nowy wygląd dotyczy wpisów utworzonych po aktualizacji; wcześniejsze wiadomości logów nie są przepisywane.

**Aktualizacja 1.1:** powitania trafiają na `1559306598927704135`. Konto `1488470377993736234` jest wpisane w `ownerIds` jako właściciel bota i ma dostęp do wszystkich komend bez roli Helper/Admin. `/uprawnienia` pokaże rozpoznany dostęp. Projekt zawiera teraz **28 komend głównych**. Przy aktualizacji Railway wgraj także nowy `config.json`, zachowaj Variables i ten sam Volume; skrypt startowy ponownie rejestruje komendy automatycznie. Istniejąca baza jest rozszerzana bez kasowania XP ani danych. Nie zastępuj bazy plikiem z innej instalacji.

Powitanie i karta poziomu mają mocno rozmyte tło w kolorach przesłanego obrazka. `cards.backgroundBlur` w `config.json` ustawia rozmycie od `0` do `20` (domyślnie `16`); zmienia tylko tło, więc napisy i avatar pozostają ostre.

## Szybki start

1. Zainstaluj **Node.js 22.18 lub nowszy** (polecana aktualna wersja LTS) z https://nodejs.org/ i rozpakuj cały ZIP.
2. W https://discord.com/developers/applications utwórz aplikację i bota. W sekcji **Bot → Privileged Gateway Intents** włącz **Server Members Intent** oraz **Message Content Intent**. Presence Intent nie jest potrzebny.
3. Skopiuj `.env.example` do `.env`. Uzupełnij:

   ```dotenv
   DISCORD_TOKEN=token_z_zakladki_Bot
   CLIENT_ID=Application_ID_z_General_Information
   GUILD_ID=ID_Twojego_serwera
   DATABASE_PATH=data/bot.sqlite
   ```

   ID serwera: włącz w Discordzie Ustawienia → Zaawansowane → Tryb dewelopera, następnie prawy przycisk na serwerze → Kopiuj ID serwera. **ID serwera nie jest ID kanału.** Token zostaw tylko w swoim `.env`.

4. Zaproś bota przez **OAuth2 → URL Generator**: zakresy `bot` i `applications.commands`. Zaznacz uprawnienia:
   - View Channels, Send Messages, Embed Links, Attach Files, Read Message History;
   - Manage Messages, Manage Roles, Manage Channels, Move Members, Connect;
   - Moderate Members, Ban Members, Kick Members, Manage Nicknames, View Audit Log.

   Sprawdź również nadpisania uprawnień poszczególnych kanałów i kategorii AUTO KANAŁU. Właściciel bota nie potrzebuje tokenu użytkownika ani self-bota.

5. Przenieś rolę bota **nad wszystkie role, które ma nadawać**, oraz nad członków, których ma moderować. Role Szef/Admin/Helper powinny być nad zwykłymi rolami zgodnie z hierarchią serwera. Discord nie pozwala timeoutować właściciela ani osób z uprawnieniem Administrator.
6. W terminalu otwartym w katalogu projektu wykonaj:

   ```sh
   npm ci
   npm run deploy
   npm start
   ```

7. Na serwerze uruchom `/konfiguracja`, następnie `/powitanie-test` i **`/regulamin`**. Ostatnia komenda publikuje gotowy embed na kanale `1515442667750948914`. Kolejne użycie aktualizuje ten sam post.

Bot działa, gdy działa proces `npm start`. Aby był online 24/7, uruchom go na stale działającym hostingu/VPS. Działa jako jedna instancja na jednym serwerze. Nie uruchamiaj równolegle kilku procesów z tą samą bazą/tokenem. Po zmianie kodu/config zrestartuj proces; po zmianie definicji komend ponownie wykonaj `npm run deploy`.

## Kanały i role

| Funkcja | ID |
|---|---|
| Powitania | 1559306598927704135 |
| AUTO KANAŁ — zwykły kanał głosowy | 1516765981244915825 |
| Logi wiadomości | 1517117542223839353 |
| Wejścia, wyjścia, audyt i zmiany ról | 1517117609617915934 |
| Awanse poziomów | 1559306736433766500 |
| Regulamin | 1515442667750948914 |

Nie podano osobnego kanału zmian ról/moderacji, dlatego `channels.moderation` wskazuje kanał kont. Możesz go zmienić niezależnie. `/konfiguracja` sprawdza istnienie i typy kanałów oraz uprawnienia na prawdziwym serwerze.

Automatyczne role po wejściu: `1517118754037698631`, `1516502263944839359`, `1516502180759212112`. Przy włączonym Membership Screening bot czeka, aż osoba zaakceptuje zasady Discorda. Role zdobyte przez XP są przywracane po ponownym wejściu.

| Rola | ID | Dostęp do komend |
|---|---|---|
| Szef | 1515440522225913926 | Wszystkie funkcje bota |
| Admin | 1516499895434088508 | Moderacja, publikacja, giveaway, diagnostyka |
| Helper | 1526998317014323221 | Timeout, zdjęcie timeoutu, clear, warn, warny i komendy publiczne |
| Booster | 1515748354426933269 | Mnożnik XP ×1,5 |
| Weteran | 1517165022151704626 | Obrazki i inne linki; nadal bez zaproszeń Discord |

**Właściciel bota: użytkownik `1488470377993736234`** (nie ID roli). Wpis `ownerIds` daje najwyższy dostęp do komend i paneli, niezależnie od posiadanych ról i ich pozycji. Konto jest chronione przed moderacją przez tego bota także wtedy, gdy nie jest członkiem serwera. Właściciel bota ma też dostęp do zdjęć i linków bez poziomów; zaproszenia Discord nadal są blokowane. Właściciel serwera ma dostęp Szefa. Pozostałe konta są oceniane na podstawie ID powyższych ról. Helper nie może banować, wyrzucać, zmieniać XP, tworzyć giveaway, publikować embedów ani zarządzać cudzym voice. Dla zwykłej kadry komendy chronią równe/wyższe role. Sam bot nadal potrzebuje uprawnień Discord i odpowiednio wysokiej roli; żadne ID właściciela nie obchodzi ograniczeń API Discorda.

## Komendy

| Komenda | Działanie |
|---|---|
| `/pomoc` | Lista funkcji i zasad XP |
| `/avatar [osoba]` | Avatar własny lub wybranej osoby |
| `/poziom [uzytkownik]` | Karta canvas: poziom, XP, ranking, postęp |
| `/ranking` | TOP 10 zapisanej aktywności |
| `/mute osoba czas powod` | Timeout, np. `30m`, `2h`, `7d`, `1h30m`; maks. 28 dni |
| `/unmute osoba powod` | Zdjęcie timeoutu |
| `/ban osoba powod [czas]` | Ban stały lub czasowy, min. 1 minuta, maks. 365 dni |
| `/unban id powod` | Odbanowanie po ID użytkownika |
| `/embed [kanal]` | Formularz: tytuł, treść, tekst poza embedem, kolor; podgląd i przycisk publikacji |
| `/regulamin` | Publikacja/aktualizacja regulaminu na wskazanym kanale |
| `/giveaway start` | Nagroda, czas, wiadomość, wymagana rola, liczba wiadomości, zwycięzcy, kanał |
| `/giveaway koniec id` | Wcześniejsze zakończenie i losowanie |
| `/giveaway reroll id` | Nowe losowanie z pominięciem dotychczasowych zwycięzców |
| `/konfiguracja` | Sprawdzenie ID i uprawnień |
| `/powitanie-test` | Prywatny podgląd powitania bez udawanego wejścia na serwer |
| `/uprawnienia` | Twój poziom dostępu i rozpoznanie właściciela po ID |
| `/ping` | Opóźnienie Gateway |
| `/botinfo` | Czas pracy, pamięć i wersja środowiska bota |
| `/userinfo [osoba]` | Informacje o osobie, role, XP i daty |
| `/serverinfo` | Informacje o serwerze, kanały, role i boosty |
| `/rola-info rola` | ID, kolor, pozycja i uprawnienia roli |
| `/kick osoba powod` | Wyrzucenie z serwera (Admin i wyżej) |
| `/clear ilosc [osoba]` | Usunięcie do 100 wiadomości z ostatnich 100; pomija przypięte i starsze niż 14 dni (Helper i wyżej) |
| `/slowmode sekundy [kanal]` | Tryb powolny 0–21600 s; 0 wyłącza (Admin i wyżej) |
| `/warn osoba powod` | Trwałe ostrzeżenie bez automatycznej kary (Helper i wyżej) |
| `/warny [osoba]` | Własne ostrzeżenia; Helper może sprawdzać wszystkich |
| `/unwarn id powod` | Cofnięcie ostrzeżenia po numerze, z zachowaniem historii (Admin i wyżej) |
| `/nick osoba powod [nazwa]` | Zmiana pseudonimu; brak nazwy usuwa pseudonim (Admin i wyżej) |
| `/xp dodaj osoba ilosc powod` | Dodanie XP, bez zmian licznika wiadomości (Admin i wyżej) |
| `/xp usun osoba ilosc powod` | Odjęcie XP, minimum 0 (Admin i wyżej) |
| `/xp ustaw osoba ilosc powod` | Ustawienie dokładnego XP (Admin i wyżej) |
| `/ustaw-poziom osoba poziom powod` | Ustawienie poziomu 0–100 według wzoru XP (Admin i wyżej) |

Komendy administracyjne mogą być widoczne w menu slash dla innych osób, ale próba użycia jest odrzucana przez sprawdzanie ID właściciela i ról w kodzie. Jeśli Discord sam ukrył komendę przez ustawienia integracji, nadaj temu kontu dostęp w integracji — bot nie otrzymuje zablokowanych przez Discord interakcji.

Ręczne zmiany XP dopasowują wszystkie skonfigurowane role poziomów, również usuwają role wyższych progów po obniżeniu poziomu (także nadane wcześniej ręcznie). Inne role pozostają bez zmian. Błąd synchronizacji jest zapisywany i ponawiany po restarcie. Korekta XP nie dopisuje wiadomości do wymagań giveaway i nie wysyła publicznego awansu; zapisuje działanie w logach. Limit łącznego XP przy korekcie to 10 000 000.

## Wolne poziomy

Próg łącznego XP na poziom **L** wynosi **250 × L² + 750 × L**.

| Poziom | Łączne XP | Rola |
|---|---:|---|
| 5 | 10 000 | 1516500127433621504 |
| 10 | 32 500 | 1516502881115836528 |
| 20 | 115 000 | 1516499892154007562 |
| 30 | 247 500 | 1516503624946286754 |
| 40 | 430 000 | 1516503622337171456 |
| 50 | 662 500 | 1516503826599903384 |

- Wiadomość: losowo **10–16 XP**, najwyżej raz na **60 sekund**, min. **8 liter/cyfr**. Szybkie powtórzenia, identyczna poprzednia treść w ciągu 5 minut, edycje i treści usunięte przez filtr nie naliczają XP. To ogranicza spam; nie jest analizą sensu każdej wypowiedzi.
- Voice: **20 XP co 5 minut ciągłej aktywnej obecności**, gdy na kanale są co najmniej **2 aktywne osoby**. Boty, AFK, kanał tworzenia, mute, deafen i wyciszeni słuchacze Stage nie naliczają XP. Zmiana kanału lub utrata warunków zeruje bieżący odcinek 5 minut. Bot nie nasłuchuje mikrofonu i nie nagrywa rozmów.
- Booster: **1,5× XP**, także na voice. Połówki XP są zachowywane.
- Nagrody za poziomy są **narastające**: na LV20 zostają także role LV5/LV10. Błędy nadawania ról są ponawiane. XP i liczba kwalifikowanych wiadomości są trwałe.
- Wymóg wiadomości w giveaway oznacza **wiadomości zakwalifikowane przez powyższy licznik od uruchomienia bota**, a nie całą historyczną liczbę postów. Przeszła historia serwera nie jest importowana.
- Utracona aktywność podczas wyłączenia bota nie jest dopisywana po starcie. Ranking zachowuje zapisane wyniki również osób, które opuściły serwer.

## Linki, obrazki i GIF-y

- Załączniki, zdjęcia i naklejki: **LV5 lub Weteran**. Dla spójności próg dotyczy wszystkich załączników, także filmów i plików.
- Linki, w tym GIF-y wysłane jako link Tenor/Giphy: **LV10 lub Weteran**.
- Bez Weterana dozwolone są wyłącznie domeny Giphy (`giphy.com`, `gph.is`), Tenor, Roblox, YouTube (`youtube.com`, `youtu.be`), TikTok, Twitch Clips (`clips.twitch.tv`) i Medal (`medal.tv`) oraz ich prawdziwe subdomeny.
- „Klipy” zinterpretowano jako Twitch Clips i Medal. Zmienisz listę w `automod.allowedDomains`.
- **Zaproszenia Discord są blokowane każdemu, również Weteranom i kadrze.** Reguły dotyczą też edycji wiadomości. Boty i webhooki są pomijane.
- Ręcznie nadana rola progowa LV5/LV10 lub wyższa również odblokowuje odpowiedni dostęp; nie podwyższa licznika XP.

Filtr rozpoznaje zwykłe URL-e, domeny bez protokołu i typowe ukrywanie zaproszeń przez spacje, znaki zerowej szerokości, Markdown i kodowanie procentowe. Nie odwiedza cudzych linków, więc nie sprawdza docelowej strony ukrytej za zewnętrznym przekierowaniem. Nie rozpoznaje zaproszeń zapisanych na obrazkach/QR. Bot musi widzieć wiadomość i mieć Manage Messages, aby ją usunąć. Usunięcie następuje po odebraniu wiadomości przez bota, więc nie jest blokadą wysłania po stronie klienta Discorda.

## Własne kanały głosowe

Wejdź na AUTO KANAŁ i pozostań przez **5 sekund**. Bot tworzy voice w tej samej kategorii, przenosi Cię i wysyła **panel w czacie tego kanału głosowego** (ikona czatu przy voice).

Panel: nazwa, limit 0–99, blokada wejścia, ukrycie, dopuszczenie osoby, odebranie dostępu, przekazanie własności, przejęcie opuszczonego kanału i usunięcie. Kontrolę ma właściciel oraz Admin/Szef. Przejąć opuszczony kanał może jego aktualny uczestnik. Ręczne usunięcie nie rozłącza innych uczestników.

Puste kanały są sprzątane, a stan i przyciski działają po restarcie. Nowy pusty kanał ma krótką ochronę na czas aktualizacji stanu Discorda; sprzątanie awaryjne działa co minutę. Maksymalnie 40 tymczasowych kanałów jednocześnie. Uprawnienia kategorii są zachowywane. Osoby z systemowym uprawnieniem Administrator Discorda mogą obejść blokadę/ukrycie — wynika to z zasad platformy.

## Giveaway, bany, logi i dane

Giveaway działa od 1 minuty do 30 dni, z maks. 20 zwycięzcami. Rola, obecność na serwerze i kwalifikowane wiadomości są sprawdzane przy dołączaniu oraz ponownie przy losowaniu. Losowanie używa generatora kryptograficznego bez duplikatów. Wynik zapisuje się przed aktualizacją ogłoszenia, więc awaria publikacji nie losuje ponownie. Wynik pojawia się w tym samym embedzie bez masowego pingowania. Nagrodę przekazuje organizator.

Bany czasowe i giveaway są zapisane w SQLite. Harmonogram sprawdza zaległe działania co 30 sekund, także po restarcie. Ban nie wygaśnie, gdy bot jest offline; zostanie cofnięty po powrocie. Ban nałożony później ręcznie bez znacznika bota nie zostanie cofnięty przez stary harmonogram. Timeout jest natywną funkcją Discorda i wygasa po stronie Discorda.

Logi obejmują wejścia/wyjścia, role, pseudonimy, timeouty, boosty, wpisy audytu dostępne botowi, GIF-y, edycje i usuwanie (również zbiorcze). Edycja ma przycisk do wiadomości; usunięcie — do kanału, bo skasowanej wiadomości nie da się otworzyć. Pełna dostępna treść i adresy załączników są w plikach TXT przy logach. Oddzielny wpis audytu może uzupełniać log zmiany o wykonawcę.

Bot nie odzyskuje wiadomości, których nigdy nie widział. Lokalny cache wiadomości obejmuje maks. 7 dni i 100 000 wpisów. Załączniki/GIF-y są logowane przez URL, **nie są trwale kopiowane**: adres Discord CDN może wygasnąć. Cache nie obejmuje wiadomości botów ani samych kanałów logów. Usuń dostęp zwykłym użytkownikom do kanałów logów; mogą one zawierać skasowaną treść i ID osób.

Baza jest w `data/bot.sqlite`. Nie kasuj jej przy aktualizacji. `npm run backup` tworzy spójną kopię SQLite w `backups/`, także gdy bot działa. Aby odtworzyć kopię, zatrzymaj bota i zastąp bazę kopią; nie pozostawiaj starych plików `bot.sqlite-wal`/`bot.sqlite-shm`. Zachowaj poprzedni katalog danych jako kopię przed odtworzeniem. Nie publikuj `.env` ani bazy. Czyszczenie lokalnego cache nie usuwa postów już opublikowanych na kanałach logów.

## Docker (opcjonalnie)

Po uzupełnieniu `.env`:

```sh
docker compose build
docker compose up -d
docker compose logs -f
```

Kontener synchronizuje komendy slash przed uruchomieniem bota. Jeżeli rejestracja komend się nie uda, przyczyna pojawi się w logach i start zostanie zatrzymany.

Nazwany wolumen `bot-data` zachowuje bazę. `docker compose down` zatrzymuje usługę. Nie dodawaj `-v`, jeśli chcesz zachować dane. Wersja Docker nie była uruchamiana w środowisku przygotowania projektu; kod i testy sprawdzono lokalnie w Node.js.

## Weryfikacja i rozwój

```sh
npm run check   # składnia, konfiguracja, zasoby i definicje slash
npm test        # testy logiki i integracji z atrapami API Discord
npm run preview # przykładowe grafiki w preview/
npm run backup  # spójna kopia bazy
```

Kod został sprawdzony lokalnie bez tokenu i bez połączenia z Twoim serwerem. Testy obejmują m.in. filtrowanie, hierarchię kadry, XP, restart, trwałe losowania/bany, uprawnienia voice i logi. Po uruchomieniu sprawdź `/konfiguracja` i wykonaj próbę z kontem testowym: wejście, trzy autorole, voice5s, zdjęcie/link przed progiem, edycję, usunięcie oraz giveaway. Prawdziwe ID/uprawnienia można zweryfikować dopiero na serwerze.

Zależności są przypięte w `package-lock.json`; instaluj przez `npm ci`. Kod używa discord.js14.26.4 i @napi-rs/canvas1.0.11. Ostrzeżenie Node22 o eksperymentalnym `node:sqlite` jest spodziewane. Tło jest dostarczonym przez Ciebie plikiem; czcionka Manrope ma licencję OFL dołączoną w `assets/FONT-LICENSE.txt`.

Źródła techniczne: [Discord.js](https://discord.js.org/docs/packages/discord.js/14.26.4), [Gateway i intents](https://discord.com/developers/docs/events/gateway), [Guild Member i timeout](https://discord.com/developers/docs/resources/guild#modify-guild-member), [SQLite w Node.js](https://nodejs.org/docs/latest-v22.x/api/sqlite.html), [Canvas](https://github.com/Brooooooklyn/canvas).
