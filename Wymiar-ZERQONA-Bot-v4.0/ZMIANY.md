# Wymiar ZERQONA v4.0 — najważniejsze zmiany

- przebudowany czarno-biało-fioletowy styl Canvas z ręcznie rysowanymi, komiksowymi detalami;
- usunięty wizualny motyw kryształów/diamentów z ekonomii i sklepu; waluta jest prezentowana jako `ZC`;
- wszystkie boosty są czasowe; stałe pozostają wyłącznie przedmioty kosmetyczne (tytuły, motywy i ramki);
- `/praca`, `/daily` i `/weekly` po udanym odbiorze publikują osobną kartę Canvas wypłaty; cooldown nadal odpowiada prywatnie;
- `/ekonomia` oraz `/nagrody` są domyślnie publiczne i mają opcję `prywatnie:true`;
- dodano `/komendy status`, `/komendy synchronizuj`, `/komendy wyczysc_stare`;
- `npm run deploy:clean` usuwa stare globalne slash commandy i atomowo zastępuje zestaw komend serwera;
- `npm run commands:status` pokazuje rozbieżności, a `npm run commands:clear` usuwa wszystkie komendy aplikacji;
- zachowano legacy ID przedmiotów i schemat bazy, aby aktualizacja nie usuwała wcześniejszych zakupów/danych;
- sloty używają korony zamiast diamentu jako specjalnego symbolu 8×.
