# WIDMO — lista wdrożeniowa

## Railway
- [ ] Repozytorium ma `Dockerfile`, `package.json` i `package-lock.json` w katalogu głównym usługi.
- [ ] Ustawiono `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID` i `DATABASE_PATH=/app/data/bot.sqlite`.
- [ ] Dodano Railway Volume z Mount Path `/app/data`; usługa działa jako jedna replika.
- [ ] W Developer Portal włączono **Server Members Intent** i **Message Content Intent**.
- [ ] Bot ma uprawnienia `View Channels`, `Send Messages`, `Embed Links`, `Attach Files`, `Read Message History`, `Manage Messages`, `Manage Roles`, `Manage Channels`, `Move Members`, `Connect`, `Moderate Members`, `Ban Members`, `Kick Members` i `View Audit Log`.
- [ ] Rola bota jest wyżej od trzech ról auto i pozostałych ról, którymi bot zarządza.

## Kanały zdefiniowane w `config.json`
- Powitania z kartą Canvas: `1559306598927704135`.
- Informacje o poziomach: `1559306736433766500`.
- Kanał wyzwalający tworzenie tymczasowego voice: `1516765981244915825`.
- Logi edycji/usunięć i linków: `1517117542223839353`.
- Logi wejść/wyjść/zmian kanału głosowego i tworzenia/usuwania temp voice: `1517117569566507029`.
- Logi dołączeń/wyjść z serwera, daty utworzenia konta i avatara: `1517117609617915934`.
- Logi komend slash, zmian ról/kanałów i audytu: `1517117642794602516`.
- Role automatyczne, które muszą mieć zarówno nowi, jak i obecni członkowie: `1517118754037698631`, `1516502263944839359`, `1516502180759212112`.

## Testy po pierwszym uruchomieniu
- [ ] `/widmo-setup` uzupełnia strukturę WIDMO. Jawne kanały powyżej pozostają na swoich miejscach.
- [ ] W `1559306598927704135` pojawia się powitanie z kartą PNG; biały duch z logo jest rozmyty w tle, avatar i tekst pozostają ostre.
- [ ] W `1559306736433766500` pojawia się jeden panel poziomów z banerem Canvas i przyciskami `Moja karta`, `Ranking TOP 10`, `Jak zdobywać XP` i `Nagrody za poziom`; restart edytuje tę samą wiadomość.
- [ ] `/panel` jako administrator odświeża istniejący panel bez tworzenia duplikatu.
- [ ] `/poziom` pokazuje nową kartę z avatar-em, XP, poziomem i postępem; `Moja karta` z panelu zwraca prywatny wynik.
- [ ] `/ranking` i przycisk `Ranking TOP 10` pokazują graficzną tablicę dusz.
- [ ] Awans wysyła osobną kartę `AWANS!`, nie zwykłą kartę profilu.
- [ ] Nowa osoba otrzymuje wszystkie trzy role, jeśli bot może nimi zarządzać.
- [ ] Po starcie bot skanuje istniejących członków i dodaje brakujące role z kolejki; osoby w Membership Screening dostają role po akceptacji.
- [ ] Wejście do `1516765981244915825` utrzymane przez 5 sekund tworzy kanał z panelem i przenosi osobę.
- [ ] Kiedy kanał tymczasowy jest pusty przez 5 sekund, znika; wejście osoby w trakcie odliczania anuluje usunięcie.
- [ ] Wejścia, wyjścia, przeniesienia i lifecycle temp voice trafiają do `1517117569566507029`.
- [ ] Linki/GIF-y, edycje, usunięcia i bulk delete trafiają do `1517117542223839353`.
- [ ] Wejścia/wyjścia z serwera zawierają avatar, ID, datę utworzenia konta oraz datę dołączenia, jeśli dostępna.
- [ ] Użycie komend slash i akcje z audytu Discorda trafiają do `1517117642794602516`.
- [ ] `/panel`, `/poziom`, `/ranking`, wszystkie cztery przyciski panelu, awans XP, `/ticket-panel`, `/role-panel` i `/propozycja` działają na koncie testowym.

## Lokalne kontrole
W katalogu głównym projektu:

```sh
npm ci
npm run check
npm test
npm run preview
```

Pełne testy integracyjne wymagają zainstalowanych zależności i konfiguracji testowej. Walidacja składni nie zastępuje testu na rzeczywistym serwerze Discord.

## Walidacja w środowisku roboczym
- [x] `node --check` dla plików JavaScript w `src/`, `scripts/` i `test/`.
- [x] `config.json` poprawny składniowo.
- [x] Kontrola obecności wszystkich podanych ID kanałów i ról w konfiguracji produkcyjnej.
- [x] 21 testów czystych helperów (`level-helpers`, `automod-helpers`, `giveaway-utils`, `voice`) przeszło.
- [ ] Pełny `npm run check`, testy integracyjne i REST/Gateway na Discordzie — nie potwierdzone w tym środowisku, ponieważ lokalny `node_modules` nie zawierał `discord.js`, `@napi-rs/canvas` ani natywnej bazy; instalacja npm nie ukończyła się wcześniej z powodu błędu DNS rejestru npm.
