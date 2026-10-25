# Lista kontroli — WIDMO

## Wykonane statycznie

- [x] Konfiguracja JSON została sparsowana, a ID kanałów/istniejących ról zapisano w `config.json`.
- [x] Usunięto Helper z mapowania ról; Owner/Admin/Moderator/Booster/Weteran wskazują podane role, a konto właściciela bota działa po ID bez dodatkowej roli.
- [x] `/widmo-setup` sprawdza i synchronizuje panele; nie tworzy ról ani kanałów.
- [x] Panel poziomów używa standardowych emoji Unicode (`👻`, `🏆`, `📈`, `🎁`) zamiast znaków tekstowych powodujących `COMPONENT_INVALID_EMOJI`.
- [x] Panel ticketów ma przyciski `Clan PS99` i `Pomoc ogólna`; kategoria ticketów ma ID `1563987770391924777`.
- [x] Kanał sugestii i kanały logowania są przypisane do podanych ID.
- [x] Dockerfile instaluje fonty systemowe dla Canvas, a pliki `Dockerfile` i `railway.json` znajdują się w katalogu głównym.
- [x] Pliki JavaScript sprawdzono poleceniem `node --check`.
- [x] 24 testy helperów niezależnych od Discord.js/Canvas przeszły (`node --test` dla level, automod, giveaway, voice i community helpers).

## Sprawdź po wdrożeniu na Discordzie

- [ ] Build Railway użył Dockerfile — log: `Using detected Dockerfile!`.
- [ ] Log startowy pokazuje `[Canvas] Font kart: ...`.
- [ ] `/powitanie-test` pokazuje widoczny tekst, avatar, daty i białego ducha w tle.
- [ ] `/panel` odświeża panel w `1559306736433766500`; przyciski `Moja karta`, `Ranking TOP 10`, `Jak zdobywać XP`, `Nagrody za poziom` nie zwracają błędu emoji.
- [ ] Dołączenie członka wysyła Canvas w `1559306598927704135`.
- [ ] Trzy role automatyczne są nadawane nowym członkom i uzupełniane obecnym.
- [ ] Po wejściu na `1516765981244915825` i utrzymaniu obecności przez 5 s powstaje pokój voice; po wyjściu wszystkich pokój znika po 5 s.
- [ ] Edycje/usunięcia/linki trafiają do `1517117542223839353`.
- [ ] Voice i kanały tymczasowe są logowane w `1517117569566507029`.
- [ ] Wejścia/wyjścia członków wraz z avatarem, ID i datą utworzenia konta trafiają do `1517117609617915934`.
- [ ] Komendy slash, zmiany ról/kanałów i audyt trafiają do `1517117642794602516`.
- [ ] Oba przyciski w `1563956514417414315` tworzą prywatny kanał w `1563987770391924777`; zamknięcie zapisuje transkrypt do logów.
- [ ] `/propozycja` publikuje sugestię w `1563957007126626384`; głos można zmienić.

## Weryfikacja lokalna

Z katalogu projektu:

```sh
npm ci
npm run check
npm test
npm run preview
```

W bieżącym środowisku roboczym nie udało się pobrać zależności npm, dlatego testy integracyjne Canvas/Discord należy uruchomić lokalnie lub w Railway. Do testu integracyjnego potrzebne są prawdziwe uprawnienia i konfiguracja serwera.
