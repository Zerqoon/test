# Weryfikacja — Wymiar ZERQONA 4.0.0

Sprawdzenie lokalne: 20.09.2026, Node.js 22.16.0, Linux.

| Sprawdzenie | Wynik |
| --- | --- |
| Składnia wszystkich plików JavaScript w `src`, `scripts` i `tests` | OK |
| 52 wpisy w katalogu pomocy i obecność `/komendy` | OK |
| Wszystkie 5 boostów/consumables mają dodatni czas działania | OK |
| Brak symbolu diamentu `💎` w kodzie interfejsu | OK |
| Publiczne handlery `/praca`, `/daily`, `/weekly` używają `rewardCard` | OK |
| `/ekonomia` i `/nagrody` mają opcję `prywatnie` i domyślnie są publiczne | OK |
| System synchronizacji/czyszczenia komend globalnych i serwerowych | OK — sprawdzenie kodu + zgodność z API discord.js |
| Generowanie 17 kart PNG na zgodnym lokalnym rendererze Canvas | OK |
| Oględziny profilu, sklepu, plecaka i karty wypłaty | OK |
| `npm ci` / pełne testy `npm test` w tym środowisku | Niewykonane — środowisko nie rozwiązywało DNS `registry.npmjs.org` (`EAI_AGAIN`) |
| Połączenie i moderacja na prawdziwym Discordzie | Niewykonane — brak tokenu docelowego serwera |

W paczce nie ma `node_modules`. Na docelowym komputerze/hostingu uruchom `npm ci`, następnie `npm run verify`. Przy wdrożeniu v4 użyj `npm run deploy:clean`, aby usunąć stare globalne slash commandy i zsynchronizować bieżący zestaw serwerowy.
