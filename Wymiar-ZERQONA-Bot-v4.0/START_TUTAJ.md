# Wymiar ZERQONA v4.0 — zacznij tutaj

Ta wersja przebudowuje wygląd i ekonomię bez resetowania istniejącej bazy. Styl kart jest czarno-biało-fioletowy, bardziej rysunkowy/komiksowy. Ikony są rysowane lokalnie przez Canvas, bez zależności od zewnętrznych grafik podczas działania bota.

## Aktualizacja istniejącej wersji

1. Zatrzymaj poprzednią instancję bota.
2. Zrób kopię katalogu `data/` albo Railway Volume. Przy SQLite kopiuj dane po zatrzymaniu procesu, razem z plikami `community.sqlite-wal` i `community.sqlite-shm`, jeśli istnieją.
3. Zachowaj swój `.env` i ten sam katalog/Volume z bazą.
4. Rozpakuj v4, uruchom `npm ci`.
5. **Przy pierwszym wdrożeniu v4 uruchom `npm run deploy:clean`**. Usunie stare globalne „duchy” slash commandów i zapisze aktualny zestaw komend serwerowych.
6. Uruchom bota: `npm start`.

Nie usuwaj bazy, aby „naprawić” komendy. Stare komendy Discorda czyści warstwa rejestracji, nie baza danych.

## Pierwszy start

Wymagany jest Node.js 22.16 lub nowszy. Skopiuj `.env.example` do `.env` i ustaw przynajmniej:

```env
DISCORD_TOKEN=token_twojego_bota
GUILD_ID=id_serwera
CLIENT_ID=id_aplikacji_bota
DATA_DIR=./data
```

W Discord Developer Portal włącz **Server Members Intent** i **Message Content Intent**. Rola bota powinna znajdować się ponad rolami, którymi bot ma zarządzać.

## Stare / nieznane komendy

Najprościej:

```bash
npm run deploy:clean
```

Możesz też użyć z Discorda jako Szef:

- `/komendy status` — pokazuje aktualne, brakujące i stare komendy;
- `/komendy synchronizuj` — zastępuje komendy tego serwera bieżącym zestawem;
- `/komendy wyczysc_stare` — usuwa globalne stare komendy i synchronizuje serwer.

`npm run commands:clear` usuwa **wszystkie** globalne i serwerowe komendy aplikacji, więc używaj go tylko wtedy, gdy naprawdę chcesz wyzerować rejestrację.

## Ekonomia v4

- `/praca`, `/daily` i `/weekly` po udanym odbiorze pokazują publiczną kartę Canvas wypłaty.
- Jeśli nagroda jest jeszcze na cooldownie, odpowiedź jest prywatna, żeby nie zaśmiecać kanału.
- `/ekonomia` i `/nagrody` są domyślnie publiczne; `prywatnie:true` ukrywa wynik.
- Wszystkie boosty są czasowe. Tytuły, motywy i ramki pozostają stałymi kosmetykami, ale nie są boostami.
- Waluta jest prezentowana jako `ZC`, bez motywu kryształów/diamentów.
- `/sloty` używa korony jako specjalnego symbolu 8×.

## Kontrola przed uruchomieniem

```bash
npm run verify
npm run preview
npm run docs
npm run commands:status
```

Podglądy kart znajdują się w `previews/`, pełny katalog komend w `KOMENDY.md`, a zmiany wersji w `ZMIANY-v4.md`.
