# WIDMO — Discord bot 👻

WIDMO to polski bot Discord w czarno-białym klimacie dark fantasy. Projekt zachowuje systemy z poprzedniej paczki (moderacja, logi, poziomy, automatyczne role, prywatne kanały głosowe i giveaway), ale ma nowy branding, logo, komunikaty i jednorazowy kreator struktury serwera.

## Co jest w środku

- **`/widmo-setup`** — tworzy 6 kategorii, kanały i role; bezpiecznie uzupełnia brakujące elementy. Istniejące role zachowują swoje uprawnienia, a ustawienia kreatora są zapisywane w SQLite z kluczem serwera.
- **Logo WIDMO** w `assets/widmo-logo.png`, czarno-białe karty powitania i poziomu oraz monochromatyczne embedy.
- **Powitania i role startowe** — osobisty komunikat z tekstem w klimacie serwera; rola startowa jest nadawana nowym osobom po akceptacji Membership Screening. Obecnych członków bot nie oznacza hurtowo.
- **Moderacja** — timeout, ban stały/czasowy, unban, kick, clear, slowmode, ostrzeżenia, automod oraz audyt.
- **Poziomy i ranking** — XP z wiadomości i aktywnego voice, role progowe, karta graficzna oraz komunikat awansu.
- **Prywatne kanały głosowe** — tworzenie, zmiana nazwy i limitu, blokowanie, ukrywanie, zarządzanie dostępem, przekazanie właścicielstwa i automatyczne czyszczenie pustych pokoi.
- **Tickety prywatne** — panel przycisków, ograniczenie liczby otwartych spraw, uprawnienia autora i kadry, potwierdzenie zamknięcia oraz transkrypt TXT archiwizowany w prywatnych logach przed usunięciem kanału.
- **Role samodzielne** — panel przycisków umożliwia nadanie/zdjęcie bezpiecznych ról społecznościowych; kreator nie udostępnia ról z uprawnieniami.
- **Propozycje społeczności** — `/propozycja` publikuje pomysł w kanale sugestii, przyciski zbierają głosy „za/przeciw” i pozwalają zmienić głos.
- **Giveaway**, kreator embedów, diagnostyka konfiguracji, statystyki i logi edycji/usunięć wiadomości.

## Wymagania Discord

W Discord Developer Portal włącz dla bota **Server Members Intent** oraz **Message Content Intent**. Zaproś go z zakresami `bot` i `applications.commands`. Nadaj mu co najmniej: View Channels, Send Messages, Embed Links, Attach Files, Read Message History, Manage Messages, Manage Roles, Manage Channels, Move Members, Connect, Moderate Members, Ban Members, Kick Members i View Audit Log. Dodatkowe komendy wymagają uprawnień zgodnych z ich działaniem. Rola bota musi być wyżej niż role, które ma nadawać lub moderować.

## Railway — uruchomienie

1. Umieść zawartość folderu projektu w repozytorium GitHub. `Dockerfile` ma znajdować się w katalogu głównym usługi Railway.
2. Utwórz usługę Railway z repozytorium i dodaj w **Variables**:

   ```dotenv
   DISCORD_TOKEN=TOKEN_BOTA
   CLIENT_ID=APPLICATION_ID
   GUILD_ID=ID_SERWERA
   DATABASE_PATH=/app/data/bot.sqlite
   ```

   Opcjonalnie dodaj `OWNER_IDS=ID1,ID2` z własnymi ID użytkowników (oddzielone przecinkami). Nie umieszczaj tokenu w kodzie ani publicznym repozytorium.

3. Dodaj **Volume** o dokładnym **Mount Path `/app/data`**. To na nim bot przechowuje SQLite, ID kategorii/kanałów/ról i trwały stan systemów. Zachowaj ten wolumen przy aktualizacjach.
4. Ustaw jedną replikę, wyłącz usypianie/serverless i wybierz restart przy awarii. Bot działa przez Discord Gateway — nie wymaga publicznej domeny ani portu HTTP.
5. Wykonaj deploy. Skrypt startowy synchronizuje komendy slash i uruchamia bota. W logach powinno pojawić się `Zarejestrowano ... komend` i `WIDMO online`.
6. Na serwerze Discord uruchom **`/widmo-setup`** jako administrator. Bot utworzy strukturę i role. Potem uruchom **`/regulamin`**, sprawdź **`/konfiguracja`**, a następnie **`/powitanie-test`**.

Jeżeli bot nie może tworzyć kanałów/ról, nadaj mu `Manage Channels` i `Manage Roles`, sprawdź pozycję jego roli i uruchom `/widmo-setup` ponownie. Kreator nie usuwa kanałów ani ról. Przy ponownym deployu nie zmieniaj `DATABASE_PATH` ani nie odłączaj wolumenu.

## Uruchomienie lokalne

Wymagany jest Node.js **22.18 lub nowszy**. Skopiuj `.env.example` do `.env`, uzupełnij wartości, a następnie w katalogu projektu wykonaj:

```sh
npm ci
npm run deploy
npm start
```

Komenda `/widmo-setup` tworzy sześć kategorii w takim stylu:

- `𖤐・KRYPTA INFORMACJI` — brama, kodeks widma, ogłoszenia i wydarzenia.
- `☾・ŚWIAT ŻYWYCH` — chat, boty, galeria i poziomy dusz.
- `⛧・PORTALE GŁOSOWE` — wejście do generatora prywatnych pokoi.
- `☠・GŁOSY Z CIENIA` — pogadanki, gaming i AFK.
- `☠・SALA SZEPTÓW` — prywatne kanały ticketów; dostęp dostaje autor konkretnej sprawy, kadra i bot.
- `𖤐・ARCHIWUM CIENI` — prywatne logi wiadomości, moderacji, kont i zmian/kar; trafiają tu również transkrypty zamkniętych ticketów.

Role tworzone przez kreator nie mają uprawnień administracyjnych. **Po setupie ręcznie przydziel role właściciela/admina/moderatora zaufanym osobom** i ustaw hierarchię ról. Bot nie przydziela ich automatycznie, aby nie nadać nikomu dodatkowych uprawnień przez pomyłkę. Rola `☁・NOWA DUSZA` jest rolą startową dla nowych członków; nie jest hurtowo dodawana obecnym użytkownikom.

## Najważniejsze komendy

| Komenda | Funkcja |
|---|---|
| `/widmo-setup` | Utworzenie/uzupełnienie kanałów, kategorii i ról (Administrator) |
| `/ticket-panel` | Publikacja panelu prywatnych zgłoszeń (kadra) |
| `/role-panel` | Publikacja przycisków do samodzielnych ról (kadra) |
| `/propozycja` | Zgłoś pomysł i głosuj za/przeciw |
| `Zamknij zgłoszenie` | Eksport transkryptu do prywatnych logów i zamknięcie kanału |
| `/regulamin` | Publikacja lub aktualizacja Kodeksu Widma |
| `/konfiguracja` | Kontrola kanałów, ról i uprawnień |
| `/powitanie-test` | Prywatny podgląd karty powitalnej |
| `/pomoc` | Lista komend i zasady XP |
| `/poziom` / `/ranking` | Karta poziomu i ranking aktywności |
| `/mute` / `/unmute` | Timeout i jego zdjęcie |
| `/ban` / `/unban` / `/kick` | Moderacja użytkowników |
| `/clear` / `/slowmode` / `/warn` / `/warny` | Utrzymanie porządku |
| `/giveaway start` / `/giveaway koniec` / `/giveaway reroll` | Losowania |
| `/embed` | Formularz embeda z podglądem |
| `/ping` / `/botinfo` / `/serverinfo` / `/userinfo` | Diagnostyka i informacje |
| `/xp` / `/ustaw-poziom` | Korekta XP (administracja) |

Pozostałe komendy i szczegóły działania są dostępne po `/pomoc`. Wbudowana moderacja filtruje zaproszenia Discord i respektuje progi linków/obrazów z konfiguracji. Nie jest to ochrona przed każdym rodzajem phishingu ani linkami zapisanymi na obrazie.

## Testy i kopie zapasowe

```sh
npm run check
npm test
npm run preview
npm run backup
```

`data/bot.sqlite` zawiera XP, ostrzeżenia, giveaway, własne kanały głosowe i ustawienia kreatora. W środowisku Railway trzymaj bazę na `/app/data` i wykonuj kopie wolumenu. Nie publikuj `.env` ani bazy danych, bo logi mogą zawierać dane i treści wiadomości.

**Uwaga:** to gotowy kod źródłowy, ale nie jest podłączony do Twojego serwera — nie otrzymałem tokenu, `CLIENT_ID` ani `GUILD_ID`. Po wdrożeniu sprawdź uprawnienia na żywym serwerze.
