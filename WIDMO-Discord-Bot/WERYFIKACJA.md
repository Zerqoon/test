# Lista kontroli — WIDMO

## Wykonane statycznie

- [x] Konfiguracja JSON została sparsowana, a ID kanałów/istniejących ról zapisano w `config.json`.
- [x] Usunięto Helper z mapowania ról; Owner/Admin/Moderator/Booster/Weteran wskazują podane role, a konto właściciela bota działa po ID bez dodatkowej roli.
- [x] `/widmo-setup` sprawdza i synchronizuje panele; nie tworzy ról ani kanałów.
- [x] Panel poziomów używa zwykłych etykiet tekstowych bez emoji w komponentach, aby uniknąć `COMPONENT_INVALID_EMOJI`.
- [x] Panel ticketów ma przyciski `Clan PS99`, `Pomoc ogólna` i `Odbiór nagrody`; kategoria ticketów ma ID `1563987770391924777`.
- [x] Regulamin jest przypisany do `1515442667750948914` i automatycznie publikowany/odświeżany przy starcie oraz przez `/regulamin` lub `/widmo-setup`.
- [x] Kanał sugestii i kanały logowania są przypisane do podanych ID.
- [x] Canvas rejestruje jawnie pliki DejaVu Sans pod rodzinami `WIDMO Sans` i `WIDMO Sans Bold`; Dockerfile instaluje fontconfig/DejaVu Sans. Pliki `Dockerfile` i `railway.json` znajdują się w katalogu głównym.
- [x] Pliki JavaScript sprawdzono poleceniem `node --check`.
- [x] W wersji 4.0.1 uruchomiono 40 testów pomocniczych/regresji niezależnych od Discord.js/Canvas — wszystkie przeszły. Pełne `npm test` wymaga zainstalowanych pakietów; w bieżącym środowisku brakuje `discord.js`. Składnia wszystkich plików JS i parsowanie JSON zostały sprawdzone. Pełne testy integracyjne wymagające pakietów z npm należy uruchomić w Dockerze/Railway.

## Sprawdź po wdrożeniu na Discordzie

- [ ] Build Railway użył Dockerfile — log: `Using detected Dockerfile!`.
- [ ] Log startowy pokazuje `[Canvas] Font kart: regular=WIDMO Sans, bold=WIDMO Sans Bold` (lub jawnie podany fallback).
- [ ] `/powitanie-test` pokazuje widoczny tekst, avatar, daty i białego ducha w tle.
- [ ] `/panel` odświeża panel w `1559306736433766500`; przyciski `Moja karta`, `Ranking TOP 10`, `Jak zdobywać XP`, `Nagrody za poziom` nie zwracają błędu emoji.
- [ ] Dołączenie członka wysyła Canvas w `1559306598927704135`.
- [ ] Trzy role automatyczne są nadawane nowym członkom i uzupełniane obecnym.
- [ ] Po wejściu na `1516765981244915825` i utrzymaniu obecności przez 5 s powstaje pokój voice; po wyjściu wszystkich pokój znika po 5 s.
- [ ] Edycje/usunięcia/linki trafiają do `1517117542223839353`.
- [ ] Voice i kanały tymczasowe są logowane w `1517117569566507029`.
- [ ] Wejścia/wyjścia członków wraz z avatarem, ID i datą utworzenia konta trafiają do `1517117609617915934`.
- [ ] Komendy slash, zmiany ról/kanałów i audyt trafiają do `1517117642794602516`.
- [ ] Wszystkie trzy przyciski w `1563956514417414315` (Clan PS99, Pomoc ogólna, Odbiór nagrody) tworzą prywatny kanał w `1563987770391924777`; zamknięcie zapisuje transkrypt do logów.
- [ ] Regulamin jest widoczny na kanale `1515442667750948914` i po ponownym uruchomieniu aktualizuje tę samą wiadomość zamiast tworzyć duplikat.
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

## Poprawki wersji 4.0.0

- Dodano komendy `/nagrody-poziomu lista/ustaw/usun`, kolejkę synchronizacji nagród i porządkowanie wycofanych ról u zapisanych członków.
- Dodano test polityki kopii zapasowych; `npm run backup` przechowuje maksymalnie 20 kopii i usuwa kopie starsze niż 14 dni (można zmienić `BACKUP_RETENTION_COUNT` i `BACKUP_RETENTION_DAYS`).
- Docker buduje tylko po przejściu `npm run check` i `npm test`, rejestruje fonty i uruchamia proces bota jako nieuprzywilejowany użytkownik `node`.

## Poprawki wersji 3.4.0

- Usunięto emoji z przycisków panelu XP i ticketów; etykiety są proste i odporne na błąd `COMPONENT_INVALID_EMOJI`.
- Canvas korzysta z rodziny `sans-serif` i zwykłych wag `bold/normal`, zamiast niestandardowego aliasu, który mógł prowadzić do pustego tekstu.
- Odświeżanie istniejących paneli czyści stare załączniki przed dodaniem aktualnej grafiki.
- Dodano systematyczne publikowanie regulaminu w kanale `1515442667750948914`, z odzyskiwaniem wcześniej wysłanej wiadomości i kontrolą uprawnień.
- Rozszerzono panel ticketów o typ `Odbiór nagrody`, z osobną nazwą kanału i instrukcją bezpiecznego przekazania dowodu wygranej.
- Zmieniono nazwy i przykładowe treści na neutralne, bez motywu „krypt”/„duszy”.


## Załączniki w ticketach — wersja 4.0.1

## Poprawki regresji — wersja 4.0.2
- [x] Testy uprawnień nie używają już nieistniejącej roli Helper; odzwierciedlają skonfigurowane role Moderator/Admin/Owner.
- [x] Komunikaty i testy używają spójnego określenia Admin/Owner.
- [x] Tabela `widmo_tickets` jest inicjalizowana w module bazy, więc AutoMod nie zależy od importowania `community.js` w określonej kolejności.
- [ ] Uruchomić pełne `npm ci`, `npm run check`, `npm test` i test Canvasa w Dockerze/Railway z poprawnie pobranymi zależnościami.
- [x] Nowy ticket nadaje autorowi, moderatorom i botowi jawne `AttachFiles: true`.
- [x] Aktywny ticket omija próg poziomu XP dla zdjęć i plików; ochrona przed zaproszeniami Discord i niedozwolonymi linkami pozostaje włączona.
- [x] Przy starcie bot naprawia uprawnienia załączników także w już otwartych ticketach.
- [x] Transkrypt zapisuje nazwę pliku, typ MIME, rozmiar i URL załącznika.
- [x] Zwykłe kanały nadal wymagają progu XP dla zdjęć/plików.
- [ ] Po wdrożeniu na Discordzie wyślij testowe PNG/JPG w ticketach Clan PS99, Pomoc ogólna i Odbiór nagrody; sprawdź, czy obraz wyświetla się inline.


## Regresje z logu Railway — 4.0.2
- [x] Zaktualizowano testy moderacji, by używały skonfigurowanej roli Moderator zamiast usuniętej roli Helper.
- [x] Zaktualizowano sprawdzanie komunikatów z `Admin lub Szef` na `Admin lub Owner`.
- [x] Utworzono tabelę `widmo_tickets` w inicjalizacji bazy, eliminując błąd `no such table` przy AutoMod.
- [x] Składnia wszystkich plików JavaScript i parsowanie JSON zostały sprawdzone lokalnie. 26 testów niezależnych od Discord.js/Canvas przeszło pomyślnie.
- [ ] Pełne `npm test` wymaga zainstalowanych pakietów; instalacja w lokalnym środowisku roboczym nie zakończyła się, dlatego końcowego wyniku pełnego zestawu 99 testów nie można tu uczciwie potwierdzić. Uruchom `npm ci && npm run check && npm test` w Railway/Docker.
