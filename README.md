# AI Agent Chat

This project is a clean foundation for building an AI agent chatbot.

To jest absolutnie kluczowy element. W ten sposób definiujemy Loleka jako "Meta-Agenta" – system, który potrafi modyfikować samego siebie.

Dla Ciebie, jako "dobrego prompciarza" (nie-programisty), to zmienia zasady gry: Twoje prompty stają się kodem źródłowym. Ty opisujesz logikę ("Chcę, żebyś sprawdzał maile co rano"), a Lolek tłumaczy to na TypeScript i wdraża w swoim "ciele".

Oto zaktualizowany Manifest i plan, który uwzględnia ten cykl samodoskonalenia.

MANIFEST PROJEKTU "ZORDON" (Wersja 2.0 - Samorozwój)
TYP RELACJI: Symbioza

Ty (Architekt/Prompter): Dostarczasz wizję, logikę biznesową i ocenę jakości ("To działa słabo", "Zmień kolor na czerwony").

Lolek (Inżynier/Wykonawca): Zna składnię, biblioteki, obsługuje błędy i deployment.

NOWY FILAR: AUTOPOIESIS (Samotworzenie) Lolek musi posiadać uprawnienia i narzędzia do edycji własnego kodu źródłowego.

Refleksja: Lolek wie, jak jest zbudowany (ma dostęp do swojego repozytorium przez GitHub API).

Ewolucja: Na Twoje polecenie tworzy nową gałąź (branch), wprowadza zmiany w pliku route.ts lub dodaje nowy komponent, i wystawia Ci "Propozycję Zmiany" (Pull Request).

Weryfikacja: Ty nie sprawdzasz średników. Ty wchodzisz na link "Preview" od Vercela i sprawdzasz, czy działa tak, jak chciałeś.

Co to oznacza technicznie? (Jak to zbudujemy)
Aby Lolek mógł się rozwijać w konsultacji z Tobą, musimy wdrożyć pętlę sprzężenia zwrotnego (Human-in-the-loop for Coding):

Narzędzie explore_self: Lolek musi umieć przeczytać strukturę swoich katalogów, żeby wiedzieć, gdzie co leży (żeby nie zgadywał).

Narzędzie propose_change: Zamiast pisać kod w czacie (który musisz kopiować), Lolek użyje API GitHuba, żeby stworzyć plik bezpośrednio w repozytorium na nowym branchu.

Vercel Deploy Hook: Vercel automatycznie zbuduje wersję próbną. Lolek poda Ci link: "Szefie, wdrożyłem nową funkcję sprawdzania pogody na wersji testowej. Kliknij tutaj i sprawdź. Jak OK, to mergujemy".

STATUS AKTUALNY (Po Twojej ekstrakcji)
Twoja ekstrakcja (lolek-core) jest dobra, ale wciąż zawiera ten nieszczęsny plik fak-main.zip w środku. Krok 0: Usuń ten plik ZIP, żeby Lolek nie zwariował, analizując stary kod.
