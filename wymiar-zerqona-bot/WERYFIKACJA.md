# Weryfikacja — Wymiar ZERQONA 3.0.0

Sprawdzenie lokalne: 20.09.2026, Node.js 24.19.0, Linux.

| Sprawdzenie | Wynik |
| --- | --- |
| Instalacja zależności z package-lock.json przez npm ci | OK |
| Składnia wszystkich plików JavaScript w src, scripts i tests | OK |
| Walidacja definicji 51 komend slash przez discord.js | OK |
| Unikalność nazw i zgodność z katalogiem pomocy | OK |
| Limity odpowiedzi pomocy dla wszystkich poziomów dostępu | OK |
| Testy automatyczne | 34 zaliczone, 0 błędów |
| Migracja SQLite ze schematu poprzedniej wersji | OK |
| Ekonomia, historia, serie daily i trwałe tytuły | OK |
| Brak wielokrotnej wypłaty premii za ten sam poziom | OK |
| Prywatność paneli, podpowiedzi przedmiotów i zakup | OK |
| Hierarchia / brak uprawnień oraz odtwarzanie blokad kanału | OK |
| Naliczanie VC przy zmianie aktywności i krótkich interwałach | OK |
| Ścieżki wszystkich komend przez atrapy interakcji Discord | OK |
| Generowanie 14 kart PNG | OK |
| Oględziny profilu, rangi, portfela, rankingu i powitania | OK |
| Publiczna odmowa z wzmianką tylko wykonawcy | OK |
| Bank, wspólny limit majątku i brak tworzenia monet przy wpłacie | OK |
| Weekly, boosty o różnych mocach i kontrakty pracy | OK |
| Jednorazowe osiągnięcia po restarcie | OK |
| Trwałość kosmetyki i różnica renderowanych PNG | OK |
| Kategorie, strony, menu i pliki canvasa sklepu | OK |
| Połączenie i moderacja na prawdziwym Discordzie | Niewykonane — brak tokenu |
| Start przez plik .bat na Windows | Przygotowano; nie uruchamiano w tym środowisku Linux |

Ponowienie: `npm run verify` i `npm run preview`.

Testy używają tymczasowych baz i nie łączą się z kontem Discord. Na docelowym serwerze sprawdź `/diagnostyka`, widoczność nowych komend, uprawnienia kanałów i hierarchię ról.
