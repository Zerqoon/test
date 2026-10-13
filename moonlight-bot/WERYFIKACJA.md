# Weryfikacja paczki

- `npm run check`: OK — składnia JS, konfiguracja, zasoby graficzne i 13 definicji komend.
- `node --test`: **45 testów, 45 zaliczonych, 0 błędów**.
- Powitanie i karta poziomu wygenerowane przez właściwy moduł Canvas i sprawdzone wizualnie po zwiększeniu rozmycia tła do 16 px. Tekst i avatary pozostają ostre. Przykłady: `examples/welcome.png`, `examples/rank.png`.
- Suma SHA-256 tła w projekcie jest identyczna z oryginalnym załącznikiem.
- Utworzenie klienta discord.js i dostępność API kopii SQLite sprawdzone lokalnie.
- ZIP sprawdzony pod kątem integralności i obecności konfiguracji. Nie zawiera tokenu, pliku `.env`, bazy ani `node_modules`.

Środowisko: Node.js22.23.2 na Windows. Testy korzystają z lokalnego SQLite i atrap API Discord. Bot nie logował się do prawdziwego serwera; rzeczywiste ID, hierarchię i kanały sprawdź po uruchomieniu komendą `/konfiguracja`. Docker nie był uruchamiany. Ostatnie wywołanie `npm audit` nie zakończyło sprawdzenia z powodu niedostępnego DNS rejestru npm — wynik audytu zależności nie jest potwierdzony.
