# Wymiar ZERQONA — zacznij tutaj

Gotowy projekt bota, wersja 3.0.0. Karty i wiadomości są po polsku, w czerni, bieli i fiolecie.

## Aktualizacja istniejącego bota

1. Zatrzymaj starą instancję bota.
2. Zrób kopię całego katalogu danych (domyślnie `data/`). Przy SQLite kopiuj go po zatrzymaniu procesu, razem z ewentualnymi plikami `community.sqlite-wal` i `community.sqlite-shm`.
3. Rozpakuj tę paczkę i podmień pliki programu. Zachowaj swój `.env` oraz dotychczasowy katalog danych / ten sam Railway Volume.
4. W głównym katalogu projektu wykonaj `npm ci`, potem `npm start`. Na Railway zbuduj ponownie usługę z tego samego repozytorium i zachowaj wolumin.
5. Wersja 3.0 dodaje pola banku, boostów, wyglądu i osiągnięć bez usuwania danych. Komendy odświeżają się podczas startu. Otwórz `/pomoc` i `/diagnostyka`. Ręczna synchronizacja: `npm run deploy` (wymaga też `CLIENT_ID`).

Baza `community.sqlite` jest uzupełniana automatycznie, bez resetowania XP, sald, ostrzeżeń i pokoi. Nie usuwaj jej, aby odświeżyć komendy. W danym momencie uruchamiaj jedną instancję bota.

## Pierwszy start na Windows

1. Zainstaluj Node.js 24, minimum 24.17.0.
2. Skopiuj `.env.example` do `.env` i wpisz:

```env
DISCORD_TOKEN=token_twojego_bota
GUILD_ID=id_calego_serwera
CLIENT_ID=id_aplikacji_bota
DATA_DIR=./data
```

3. W Developer Portal włącz **Server Members Intent** i **Message Content Intent**.
4. Nadaj botowi uprawnienia opisane w README i ustaw jego rolę ponad rolami, którymi zarządza.
5. Uruchom `START_WINDOWS.bat` albo wpisz `npm ci` i `npm start` w terminalu otwartym w katalogu projektu.

`GUILD_ID` to ID całego serwera. Token pozostaje wyłącznie w `.env` lub zmiennych hostingu.

## Co sprawdzić po uruchomieniu

- `/pomoc` — menu kategorii oraz `/pomoc komenda:nazwa`.
- `/profil` — nowa karta i przyciski Profil / Ranga / Portfel.
- `/top typ:xp` — ranking z przyciskami zmiany strony.
- `/daily`, `/nagrody` — nagroda oraz kolejne terminy.
- `/sklep`, `/plecak` — canvasy, 18 przedmiotów, motywy i ramki.
- `/bank saldo`, `/weekly`, `/osiagniecia` — oszczędności i nowe nagrody.
- `/ekonomia` — dashboard przepływu monet.
- Komenda administracyjna użyta przez osobę bez roli — publiczny komunikat z oznaczeniem tej osoby.
- `/diagnostyka` — kanały, role, uprawnienia i dostęp bota.

Pełne opisy: **KOMENDY.md**. Przykładowe karty: **previews/**.

W kodzie, kartach i komunikatach używany jest Wymiar ZERQONA. Jeżeli samo konto bota na Discordzie nadal ma starą nazwę, zmień jego nick na serwerze lub nazwę aplikacji w Developer Portal — nazwa konta nie pochodzi z plików projektu.
