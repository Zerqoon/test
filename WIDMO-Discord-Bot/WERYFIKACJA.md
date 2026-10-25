# Lista kontrolna WIDMO

## Przed wdrożeniem
- [ ] Uzupełnij `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`.
- [ ] Włącz Server Members Intent i Message Content Intent.
- [ ] Zapewnij botowi `Manage Channels`, `Manage Roles`, `Send Messages`, `Embed Links`, `Attach Files`, `Read Message History`, `Manage Messages`, `Move Members`, `Connect`, `Moderate Members`, `Ban Members`, `Kick Members` i `View Audit Log`.
- [ ] Podłącz Railway Volume do `/app/data`.

## Po wdrożeniu
- [ ] `/widmo-setup` tworzy 6 kategorii, kanały i role bez duplikatów.
- [ ] `/regulamin` publikuje Kodeks Widma z logo.
- [ ] `/konfiguracja` nie zgłasza brakujących przypisań kanałów i ról.
- [ ] `/powitanie-test` renderuje czarno-białą kartę.
- [ ] Nowa osoba otrzymuje wiadomość w `†・brama` i rolę startową po akceptacji Membership Screening.
- [ ] `/poziom` i `/ranking` pokazują wyniki; awans pojawia się w `✦・poziomy-dusz`.
- [ ] Edycja/usunięcie wiadomości trafia do `†・logi-wiadomości`; moderacja i audyt do prywatnych kanałów.
- [ ] Wejście do `†・stwórz-pokój` tworzy tymczasowy kanał z panelem zarządzania.
- [ ] Sprawdź timeout, unban, giveaway i /embed na koncie testowym.

## Testy lokalne

```sh
npm run check
npm test
npm run preview
```

Testy lokalne nie zastępują kontroli uprawnień i zachowania komend na prawdziwym serwerze Discord.


## WIDMO 3.0 — dodatkowe systemy
- [ ] `/ticket-panel` publikuje panel prywatnych zgłoszeń. Po zamknięciu transkrypt TXT musi trafić do prywatnych logów przed usunięciem kanału.
- [ ] `/role-panel` publikuje role samodzielne; dostępne mogą być wyłącznie role bez uprawnień administracyjnych.
- [ ] `/propozycja` publikuje propozycję i zapisuje głosy „za/przeciw”; ponowne kliknięcie innego głosu zmienia poprzedni głos.
- [ ] Po restarcie Railway zgłoszenia, głosy i mapowania setupu są zachowane na wolumenie `/app/data`.
- [ ] Ponowne `/widmo-setup` nie tworzy duplikatów i nie zmienia uprawnień istniejących ról.

## Walidacja wykonana w środowisku roboczym
- [x] Kontrola składni wszystkich plików JavaScript w `src/`, `scripts/` oraz `test/` przez `node --check`.
- [x] Testy helperów społeczności: 3/3 zaliczone.
- [x] Parsowanie `config.json` i walidacja konfiguracji bez tokenu.
- [ ] Pełne `npm run check` i `npm test` wymagają instalacji zależności. Instalacja `npm ci` nie została ukończona w środowisku roboczym z powodu błędu DNS rejestru npm; uruchom te komendy lokalnie lub podczas builda Railway przed użyciem produkcyjnym.
