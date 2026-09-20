# Zmiany w wersji 3.0.0

- Nowy system kart 1440 px: profil z kołowym postępem i progami ról, rozbudowana ekonomia, sklep z ilustracjami produktów, plecak, bank oraz osiągnięcia.
- Wspólne rysowanie w `graphics.js`, trzy kupowane motywy i trzy ramki, działające na rzeczywistych kartach. Domyślny styl pozostaje czarno-biało-fioletowy.
- 18 opisanych produktów w czterech kategoriach sklepu, podział na strony, zakup/aktywacja, rzadkości, czas trwania i stan kolekcji.
- Publiczna odmowa użycia komendy przez osobę bez wymaganej roli: oznaczenie tej osoby i wymagany poziom dostępu. Pozostałe osoby nie są pingowane.
- Pomoc pokazuje także zablokowane komendy z wymaganiami. Ich wykonanie nadal sprawdza uprawnienia.
- 51 komend. Nowe: `/bank`, `/weekly`, `/osiagniecia`, `/personalizacja`, `/ekonomia`.
- Bank bez prowizji i odsetek, ranking banku i całego majątku, wspólny limit monet portfela i banku.
- Nagroda tygodniowa, 8 jednorazowych osiągnięć, boosty XP 1,5×/2× i kontrakty zwiększające zarobki z pracy.
- Wykres faktycznych przepływów portfela z ostatnich 7 dni; indeksy SQLite do historii i dodatkowych rankingów.
- 34 testy lokalne i 14 przykładowych kart. Dane demo oznaczono w previews/README.md.

Poniżej zmiany wcześniejszej wersji, będące również częścią tej paczki.

# Zmiany w wersji 2.0.0

- Nowy branding: **Wymiar ZERQONA**, również w kartach, pomocy, logach, panelu pokoju, metadanych projektu i statusie bota.
- Przebudowane karty: profil, ranga, portfel, powitanie; rankingi XP, monet, nagrodzonych wiadomości i czasu VC.
- 46 komend z jednolitymi opisami, kategoriami, przykładami użycia i informacjami o dostępie.
- Nowe komendy: `/nagrody`, `/poziomy`, `/historia`, `/tytul zdejmij`, `/avatar`, `/botinfo`.
- Pomoc z menu kategorii i wyszukiwaniem komendy, podpowiedzi przedmiotów z własnego plecaka, sklep z przyciskami i ceny przy wyborze `/kup`.
- Przyciski przełączania kart, strony rankingów i opcjonalne prywatne wyniki.
- Naprawiony błąd składni `/kup`, który uniemożliwiał załadowanie komend.
- Tytuły stają się trwałą kolekcją. Ponowny zakup posiadanego tytułu nie pobiera monet. Dodano Strażnika Wymiaru i Władcę Otchłani.
- Daily z serią i dokładnymi terminami odbioru. Gry pokazują osobno stawkę, wypłatę, zysk/stratę i saldo.
- Historia portfela oraz ochrona przed nieprawidłowymi kwotami i wielokrotnymi nagrodami za te same poziomy.
- `/xp ustaw` i `/monety_admin ustaw` przyjmują 0. Ręczna korekta XP nie generuje nagrody pieniężnej.
- Prywatne, uporządkowane odpowiedzi moderacji, kontrola uprawnień i hierarchii przy usuwaniu ostrzeżeń, pełniejsza diagnostyka.
- `/otworz` odtwarza faktyczne poprzednie ustawienie kanału zapisane przez `/zamknij`.
- Poprawione rozliczanie krótkich odcinków VC oraz przejść między stanem aktywnym, samotnym i AFK.
- Stara rola poziomowa jest usuwana dopiero po udanym nadaniu nowej.
- Bot zachowuje dostęp do ukrytego pokoju; przejściowy błąd API przy sprawdzaniu kanału nie usuwa zapisu pokoju.
- Ręczna rejestracja komend działa poprawnie z lokalną ścieżką Windows.
- Rozszerzone testy regresji, generowane opisy komend oraz start przez `START_WINDOWS.bat`.

## Dane podczas aktualizacji

Pozostają te same ID kanałów/ról i nazwa bazy `community.sqlite`. Migracja dodaje pola i tabele. Zachowuje saldo, XP, ostrzeżenia, pokoje oraz aktywny tytuł; dawniej zużyty, aktualnie założony tytuł odzyskuje miejsce w plecaku. Dawnych nieaktywnych tytułów ani starej historii transakcji nie da się odtworzyć z danych, których poprzednia wersja nie zapisywała.

Seria daily zaczyna się od nowego systemu. Bieżący poziom przy migracji jest uznawany za już rozliczony, aby uniknąć ponownego wypłacania dawnych nagród.
