# WIDMO — wdrożenie Railway

## Build

1. W GitHub umieść zawartość projektu bezpośrednio w katalogu głównym repozytorium.
2. Ustaw Build Builder na **Dockerfile**. `Dockerfile` instaluje `fontconfig` i `fonts-dejavu-core`; bez nich Canvas może wygenerować tło i avatar, ale nie widoczny tekst. Plik `railway.json` przypina builder do Dockerfile dla istniejących usług obsługujących Config as Code. Jeśli dashboard nadal pokazuje Railpack, wybierz Dockerfile w ustawieniach Build.
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
- Sprawdź, czy trzy role z `roles.auto` trafiają do nowych członków i czy istniejący członkowie otrzymują brakujące role. Wymaga to dostępu do listy członków i właściwej hierarchii ról.

## Naprawa typowych błędów

- **Railpack process exited** — Builder wskazuje Railpack albo katalog główny usługi nie zawiera `Dockerfile`; popraw Build Builder/Root Directory.
- **Canvas bez tekstu** — upewnij się, że budujesz Dockerfile, a nie Railpack. Dockerfile instaluje systemowe fonty i aplikacja wypisuje nazwę wybranego fontu.
- **Brak kanału/roli** — upewnij się, że ID należy do tego serwera oraz bot ma dostęp do kanału/roli.
- **Nie działa autorole** — sprawdź `Manage Roles`, hierarchię ról i oba wymagane intenty.
- **Nie da się tworzyć ticketów** — kategoria `1563987770391924777` musi być kategorią, a bot potrzebuje `Manage Channels` i dostępu do niej.
- **Panel poziomów ma stare przyciski** — użyj `/panel`; bot edytuje zapisaną wiadomość, nadpisując stare komponenty nowymi poprawnymi emoji.

Nie publikuj tokenu, `.env`, bazy SQLite ani transkryptów ticketów.
