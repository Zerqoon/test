# Komendy — Wymiar ZERQONA

Wersja 3.0.0 • 51 komend.

W nawiasach kwadratowych podano opcjonalne parametry. Przy komendach z `osoba` brak parametru oznacza Ciebie. `prywatnie:true` ukrywa wynik przed pozostałymi osobami.

Pomoc na Discordzie: `/pomoc`, następnie wybór kategorii; dokładne zasady: `/pomoc komenda:daily`.

Właściciel serwera ma dostęp Szefa. Pozostałe uprawnienia wynikają z ID ról w `src/config.js`, a nie z samej nazwy roli. Przy moderacji obowiązuje dodatkowo hierarchia Discord.

## Start i informacje

### /pomoc

Pomoc z kategoriami, przykładami i wymaganiami komend.

Użycie: `/pomoc [kategoria] [komenda]`

Wybierz kategorię w menu lub wpisz nazwę konkretnej komendy. Pomoc jest widoczna tylko dla Ciebie.

Dostęp: **Użytkownik**.

### /ping

Sprawdź opóźnienie połączenia z Discordem i czas pracy bota.

Użycie: `/ping`

Pokazuje opóźnienie WebSocket. Chwilowy brak pomiaru po starcie nie oznacza awarii.

Dostęp: **Użytkownik**.

### /userinfo

Zobacz datę dołączenia, role i statystyki wskazanej osoby.

Użycie: `/userinfo [osoba] [prywatnie]`

Domyślnie wyświetla Twoje dane. Pokazuje maksymalnie 12 najwyższych ról.

Dostęp: **Użytkownik**.

### /serverinfo

Zobacz liczebność, kanały, boosty i datę powstania serwera.

Użycie: `/serverinfo`

Statystyki pochodzą z danych serwera dostępnych botowi.

Dostęp: **Użytkownik**.

### /avatar

Wyświetl duży awatar użytkownika i link do obrazu.

Użycie: `/avatar [osoba] [prywatnie]`

Używa awatara serwerowego, a gdy go nie ma — globalnego.

Dostęp: **Użytkownik**.

### /botinfo

Sprawdź wersję, czas pracy i możliwości bota Wymiar ZERQONA.

Użycie: `/botinfo`

Informacje o bieżącym procesie bota i skróty do najważniejszych funkcji.

Dostęp: **Użytkownik**.

## Profil i poziomy

### /osiagniecia

Sprawdź 8 osiągnięć, postęp i odbierz jednorazowe nagrody.

Użycie: `/osiagniecia`

Ukończone osiągnięcia odbierasz przyciskiem. Zapis w bazie zapobiega ponownemu odbiorowi po restarcie.

Dostęp: **Użytkownik**.

### /profil

Karta profilu: poziom, tytuł, monety, XP i aktywność.

Użycie: `/profil [osoba] [prywatnie]`

Przyciski przełączają profil, rangę i portfel wskazanej osoby. Wiadomości oznaczają tylko te nagrodzone XP.

Dostęp: **Użytkownik**.

### /ranga

Karta poziomu: miejsce w rankingu i XP do awansu.

Użycie: `/ranga [osoba] [prywatnie]`

Pokazuje bieżący poziom, dokładny postęp i brakujące XP. Ranking obejmuje zapisane profile; remisy rozstrzyga ID.

Dostęp: **Użytkownik**.

### /top

Rankingi XP, portfela, majątku, banku, wiadomości i VC — z kolejnymi stronami.

Użycie: `/top [typ] [strona] [prywatnie]`

10 osób na stronę. Dane obejmują profile zapisane w bazie, również osób, które opuściły serwer.

Dostęp: **Użytkownik**.

### /poziomy

Sprawdź progi ról, zasady XP oraz premie za poziomy.

Użycie: `/poziomy`

12–18 XP za tekst co 45 s, 8 XP/min za aktywne VC. Booster 2× i Iskra 1,5× dają razem 3×; Przebudzenie z Boosterem daje 4×.

Dostęp: **Użytkownik**.

## Ekonomia i bank

### /weekly

Odbierz 1200 wirtualnych monet raz na 7 dni.

Użycie: `/weekly`

Termin wynosi 7 × 24 godziny od poprzedniego odbioru. Nagroda nie zależy od dnia tygodnia.

Dostęp: **Użytkownik**.

### /bank

Sprawdź bank i przenoś monety między portfelem a oszczędnościami.

Użycie: `/bank saldo | wplac ilosc:500 | wyplac ilosc:500`

Przelewy wewnętrzne bez prowizji. Bank nie nalicza odsetek. Gry i sklep używają tylko monet w portfelu.

Dostęp: **Użytkownik**.

### /ekonomia

Otwórz prywatny dashboard portfela, banku, historii i nagród.

Użycie: `/ekonomia`

Canvas pokazuje faktyczny przepływ monet przez ostatnie 7 dni (UTC), wydatki, nagrody i dostępność daily/pracy/weekly.

Dostęp: **Użytkownik**.

### /portfel

Karta monet, pozycji w rankingu i dostępności nagród.

Użycie: `/portfel [osoba] [prywatnie]`

Monety są wirtualną walutą serwera. Przełączniki prowadzą do profilu i rangi.

Dostęp: **Użytkownik**.

### /daily

Odbierz 350–650 monet co 24 h; utrzymuj serię kolejnych odbiorów.

Użycie: `/daily`

Pierwszy odbiór: 350. Każdy kolejny: +50, maks. 650 od 7. odbioru. Przerwa ponad 48 h resetuje serię.

Dostęp: **Użytkownik**.

### /praca

Wykonaj zadanie i odbierz losowo 100–240 monet co 45 minut.

Użycie: `/praca`

Nagroda trafia od razu do portfela. /nagrody pokazuje dokładny termin następnej pracy.

Dostęp: **Użytkownik**.

### /nagrody

Sprawdź terminy daily i pracy, serię oraz aktywne bonusy XP.

Użycie: `/nagrody`

Prywatny panel Twoich nagród. Przedłużenie Iskry dodaje czas, nie kolejny mnożnik.

Dostęp: **Użytkownik**.

### /przelew

Przekaż od 1 do 1 000 000 000 monet innej osobie na serwerze.

Użycie: `/przelew osoba:@osoba ilosc:500`

Bez prowizji. Nie możesz wysłać monet sobie ani botowi. Operacja zapisuje się w historii obu osób.

Dostęp: **Użytkownik**.

### /historia

Zobacz do 15 ostatnich operacji swojego portfela.

Użycie: `/historia [ile]`

Prywatna historia od wersji 2.0: nagrody, sklep, gry, przelewy i korekty administracji.

Dostęp: **Użytkownik**.

## Sklep i kolekcja

### /personalizacja

Zobacz wygląd swojego profilu albo przywróć motyw i ramkę domyślną.

Użycie: `/personalizacja podglad | reset`

Kupione motywy i ramki zakładasz przez /uzyj lub /plecak. Reset nie usuwa przedmiotów ani tytułu.

Dostęp: **Użytkownik**.

### /sklep

Przeglądaj przedmioty, ceny, stan posiadania i przyciski zakupu.

Użycie: `/sklep [kategoria]`

Canvas pokazuje ceny, rzadkość, czas efektu i stan kolekcji. Filtruj kategorie oraz strony i kupuj przyciskiem.

Dostęp: **Użytkownik**.

### /kup

Kup boost, tytuł, motyw karty lub ramkę awatara za monety z portfela.

Użycie: `/kup przedmiot:xp_boost`

Zakup nie aktywuje przedmiotu. Użyj /uzyj. Ponowny zakup posiadanego tytułu jest zablokowany.

Dostęp: **Użytkownik**.

### /plecak

Sprawdź przedmioty, posiadane tytuły i aktywny bonus XP.

Użycie: `/plecak`

Tytuły możesz zakładać bez zużywania. Iskry znikają z plecaka po aktywacji.

Dostęp: **Użytkownik**.

### /uzyj

Aktywuj posiadany bonus XP albo załóż kupiony tytuł.

Użycie: `/uzyj przedmiot:xp_boost`

Podpowiedzi pokazują Twój plecak. Boosty tego samego mnożnika wydłużają czas; różne mnożniki tego samego rodzaju nie łączą się. Motywy i ramki zmieniają karty.

Dostęp: **Użytkownik**.

### /tytul

Zdejmij tytuł z karty, zachowując go w swojej kolekcji.

Użycie: `/tytul zdejmij`

Aby ponownie założyć tytuł, użyj /uzyj przedmiot:<tytuł>.

Dostęp: **Użytkownik**.

## Zabawa i ankiety

### /moneta

Wybierz orła lub reszkę; opcjonalnie zagraj o wirtualne monety.

Użycie: `/moneta strona:orzel [stawka:100]`

Obie strony mają szansę 50%. Trafienie wypłaca 2× stawkę (zysk 1×), przegrana zabiera stawkę.

Dostęp: **Użytkownik**.

### /sloty

Losuj 3 symbole; para płaci 1,5×, trójka 5×, trzy diamenty 8×.

Użycie: `/sloty stawka:100`

Stawka 1–100 000. Mnożniki oznaczają całą wypłatę, razem ze stawką; wynik jest zaokrąglany w dół. To wirtualne monety.

Dostęp: **Użytkownik**.

### /kostka

Rzuć kością o wybranej liczbie ścian: od 2 do 100.

Użycie: `/kostka [sciany:20]`

Domyślnie klasyczna kostka sześciościenna. Komenda nie pobiera monet.

Dostęp: **Użytkownik**.

### /wrozba

Zadaj pytanie i otrzymaj losową odpowiedź Wyroczni Wymiaru.

Użycie: `/wrozba pytanie:Czy dziś wygram?`

Losowa odpowiedź dla zabawy, bez wpływu na XP i portfel.

Dostęp: **Użytkownik**.

### /kpn

Zagraj z botem w kamień, papier, nożyce — bez stawki.

Użycie: `/kpn wybor:kamien`

Papier wygrywa z kamieniem, kamień z nożycami, nożyce z papierem.

Dostęp: **Użytkownik**.

### /ankieta

Utwórz ankietę z 2–4 różnymi opcjami i reakcjami do głosowania.

Użycie: `/ankieta pytanie:W co gramy? opcja1:Roblox opcja2:CS2`

Każda osoba może zaznaczyć kilka reakcji. Ankieta nie zamyka się automatycznie. Bot potrzebuje Add Reactions i Read Message History.

Dostęp: **Użytkownik**.

## Pokoje głosowe

### /pokoj

Otwórz panel nazwy, limitu, dostępu i właściciela pokoju VC.

Użycie: `/pokoj`

Wejdź do lobby, aby utworzyć pokój. Panel jest dostępny w jego czacie. Pusty pokój znika po 30 sekundach.

Dostęp: **Użytkownik**.

## Moderacja

### /ostrzezenia

Pokaż własne ostrzeżenia; ekipa może sprawdzać inne osoby.

Użycie: `/ostrzezenia [osoba]`

Prywatny widok ostatnich 15 ostrzeżeń. Każde ma numer, powód, datę i moderatora.

Dostęp: **Użytkownik**.

### /warn

Zapisz ostrzeżenie z powodem i numerem sprawy.

Użycie: `/warn osoba:@osoba powod:Powód`

Wymagana rola Helper lub wyższa. Obowiązuje hierarchia ról. Sam warn nie nakłada timeoutu.

Dostęp: **Helper (Strażnik)** lub wyższy.

### /unwarn

Usuń ostrzeżenie po jego numerze, z kontrolą hierarchii ról.

Użycie: `/unwarn numer:12`

Numer odczytasz w /ostrzezenia. Usunięcie trafia do logu ekipy.

Dostęp: **Helper (Strażnik)** lub wyższy.

### /wyczysc

Usuń 1–100 ostatnich wiadomości młodszych niż 14 dni.

Użycie: `/wyczysc ilosc:25`

Bot potrzebuje Manage Messages i Read Message History. Wynik podaje faktyczną liczbę usuniętych wiadomości.

Dostęp: **Helper (Strażnik)** lub wyższy.

### /timeout

Ogranicz komunikację użytkownika na 1–40 320 minut.

Użycie: `/timeout osoba:@osoba minuty:60 powod:Powód`

Maksymalnie 28 dni. Bot potrzebuje Moderate Members. Nie działa na właściciela ani administratorów.

Dostęp: **Moderator (Namiestnik)** lub wyższy.

### /untimeout

Zakończ aktywny timeout użytkownika, zapisując powód.

Użycie: `/untimeout osoba:@osoba powod:Powód`

Zdejmuje przerwę Discord; nie zmienia ról ani stanu wyciszenia mikrofonu.

Dostęp: **Moderator (Namiestnik)** lub wyższy.

### /mute

Alias /timeout: ogranicz komunikację na podaną liczbę minut.

Użycie: `/mute osoba:@osoba minuty:60 powod:Powód`

Używa systemu timeout Discord. To nie jest osobna rola Mute ani wyciszenie mikrofonu.

Dostęp: **Moderator (Namiestnik)** lub wyższy.

### /unmute

Alias /untimeout: zakończ przerwę w komunikacji.

Użycie: `/unmute osoba:@osoba powod:Powód`

Działa tak samo jak /untimeout.

Dostęp: **Moderator (Namiestnik)** lub wyższy.

### /kick

Wyrzuć osobę z serwera i zapisz powód w logu.

Użycie: `/kick osoba:@osoba powod:Powód`

Osoba może wrócić przez nowe zaproszenie. Bot potrzebuje Kick Members i wyższej roli.

Dostęp: **Moderator (Namiestnik)** lub wyższy.

### /ban

Zbanuj członka serwera, zachowując jego wiadomości.

Użycie: `/ban osoba:@osoba powod:Powód`

Bot potrzebuje Ban Members i wyższej roli. Zdjęcie bana: /unban.

Dostęp: **Moderator (Namiestnik)** lub wyższy.

### /unban

Zdejmij bana po ID użytkownika i zapisz powód.

Użycie: `/unban id:123456789012345678 powod:Powód`

ID odczytasz z logów lub trybu deweloperskiego Discord. Osoba musi mieć aktywnego bana.

Dostęp: **Moderator (Namiestnik)** lub wyższy.

### /slowmode

Ustaw odstęp między wiadomościami: 0–21 600 sekund.

Użycie: `/slowmode sekundy:10`

Wartość 0 wyłącza slowmode. Zmiana dotyczy kanału, na którym użyto komendy.

Dostęp: **Moderator (Namiestnik)** lub wyższy.

### /zamknij

Zablokuj pisanie dla @everyone i zapamiętaj poprzednie ustawienie.

Użycie: `/zamknij`

Nie zmienia indywidualnych nadpisań ról/członków. Osoby z osobnym zezwoleniem lub Administrator nadal mogą pisać.

Dostęp: **Moderator (Namiestnik)** lub wyższy.

### /otworz

Przywróć uprawnienie pisania sprzed /zamknij.

Użycie: `/otworz`

Odtwarza zapisane ustawienie @everyone. Bez zapisanej blokady nie zmienia kanału.

Dostęp: **Moderator (Namiestnik)** lub wyższy.

## Zarządzanie

### /rola

Nadaj lub zdejmij rolę z kontrolą hierarchii i ról zarządzanych.

Użycie: `/rola nadaj|zdejmij osoba:@osoba rola:@rola`

Rola musi być niżej niż rola bota oraz wykonawcy (z wyjątkiem właściciela serwera).

Dostęp: **Szef** lub wyższy.

### /xp

Dodaj, odejmij lub ustaw XP; zsynchronizuj rolę poziomową.

Użycie: `/xp dodaj|odejmij|ustaw osoba:@osoba ilosc:1000`

Ustawienie 0 jest dozwolone. Korekty administracyjne nie wypłacają monet za awans.

Dostęp: **Szef** lub wyższy.

### /monety_admin

Dodaj, odejmij lub ustaw saldo wirtualnych monet.

Użycie: `/monety_admin dodaj|odejmij|ustaw osoba:@osoba ilosc:500`

Ustawienie 0 jest dozwolone. Saldo nie spada poniżej zera; korekta trafia do logu i historii.

Dostęp: **Szef** lub wyższy.

### /diagnostyka

Sprawdź kanały, role, hierarchię i uprawnienia bota.

Użycie: `/diagnostyka`

Pokazuje pełny raport w prywatnych kartach. Zielone ID nie zastępuje poprawnych uprawnień kanałów.

Dostęp: **Szef** lub wyższy.
