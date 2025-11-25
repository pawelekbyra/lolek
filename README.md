# 🔮 PROJEKT ZORDON (Lolek Core)
> "To nie jest chatbot. To autonomiczny system operacyjny dla mojego życia cyfrowego."

## 1. Misja i Filozofia
Ten projekt to coś więcej niż aplikacja. To budowa "Drugiego Mózgu" i "Centrum Dowodzenia".
W przeciwieństwie do gotowych rozwiązań (jak ChatGPT w przeglądarce), **Zordon (Lolek)** ma posiadać:
1.  **Trwałą Pamięć:** Pamięta fakty i kontekst sprzed miesięcy (nie resetuje się po zamknięciu okna).
2.  **Sprawczość (Agency):** Może sam wykonywać zadania w tle (np. "sprawdzaj to co godzinę"), nawet gdy ja śpię.
3.  **Dostęp do Świata:** Posiada "ręce" (Tools), którymi dotyka moich plików, serwerów, maili i repozytoriów.

### Rola Użytkownika (Human-in-the-loop)
Ja (Użytkownik) nie jestem programistą w tradycyjnym sensie. Jestem **Architektem i Prompterem**.
* Moim zadaniem jest dostarczanie wizji, logiki i ocenianie efektów.
* Zadaniem Agentów AI (Lolek, Jules) jest pisanie kodu, dobieranie najlepszych bibliotek i wdrażanie rozwiązań.

---

## 2. Architektura i Stack Technologiczny (Dlaczego to?)

Budujemy ten system w oparciu o "Best Practices 2025". Oto dlaczego wybraliśmy te konkretne klocki:

### 🧠 MÓZG (AI Engine)
* **Technologia:** `Vercel AI SDK` (Core & UI).
* **Model:** `Google Gemini 1.5 Pro / 3.0` (przez Vertex AI/Studio).
* **Dlaczego:** Vercel AI SDK to standard branżowy, który pozwala łatwo wymieniać modele. Gemini ma ogromne "okno kontekstowe" (może przeczytać całą książkę na raz), co jest kluczowe dla analizy moich projektów.

### 💾 PAMIĘĆ (Database & Knowledge)
* **Technologia:** `Vercel Postgres (Neon)` + `Prisma ORM` + `pgvector`.
* **Dlaczego:** Nie chcemy zwykłej bazy. Neon pozwala na "Serverless" (płacę tylko jak używam). `pgvector` pozwala na **wyszukiwanie semantyczne** (Lolek rozumie sens, a nie tylko słowa kluczowe). Prisma pozwala Agentom AI łatwo czytać i zmieniać strukturę bazy.

### 💅 TWARZ (Interface)
* **Technologia:** `Next.js App Router` + `Shadcn UI` + `Generative UI`.
* **Dlaczego:** Next.js to najnowocześniejszy framework webowy. Shadcn UI daje nam piękne, gotowe klocki (wygląda profesjonalnie od razu). **Generative UI** oznacza, że Lolek nie tylko pisze tekst, ale może wygenerować mi "w locie" wykres lub tabelę, jeśli o to zapytam.

### 🔌 ZMYSŁY (Integrations)
* **Technologia:** `MCP (Model Context Protocol)`.
* **Dlaczego:** Zamiast pisać ręcznie kod do każdego narzędzia (GitHub, Google Drive, Slack), używamy standardu MCP. To jak "USB dla AI" – podłączamy gotową wtyczkę i działa.

### ⏰ CZAS (Background Tasks)
* **Technologia:** `Inngest`.
* **Dlaczego:** Chatboty żyją tylko sekundę. Zordon musi żyć godzinami. Inngest pozwala Lolkowi "uśpić się" i obudzić, gdy zadanie (np. długi research) zostanie wykonane, bez blokowania mojej przeglądarki.

---

## 3. Protokół Pamięci (Memory Protocol) 📝
**WAŻNE:** To jest żelazna zasada dla każdego Agenta AI pracującego nad tym kodem.

Ponieważ system jest budowany iteracyjnie, **nie wolno wprowadzać zmian bez zostawienia śladu**.
Dopóki nie mamy pełnej bazy danych, używamy systemu plików jako pamięci.

**ZASADA:** Po każdej sesji programistycznej, Agent ma obowiązek stworzyć/zaktualizować plik w katalogu `.memory/changelog/`.
* Format: `YYYY-MM-DD-opis-zmiany.md`
* Treść: Co zostało zrobione, dlaczego, i co jest następnym krokiem.

---

## 4. Mapa Drogowa (Masterplan)

Agencie, zaznaczaj `[x]` przy zrealizowanych punktach.

### Faza 0: Czysta Karta (Fundamenty)
- [ ] **Oczyszczenie Repo:** Usunięcie `fak-main.zip` i innych śmieci z poprzedniego projektu.
- [ ] **Inicjalizacja:** Stworzenie pustego `app/api/chat/route.ts` oraz struktury katalogów `.memory`.

### Faza 1: Twarz (Interfejs Użytkownika)
- [ ] **Instalacja UI:** Wdrożenie `shadcn/ui` i gotowego szablonu "Vercel Chatbot" (Sidebar, okno czatu, input).
- [ ] **Podłączenie AI:** Podpięcie prostego modelu Gemini, żeby "gadał" (jeszcze bez pamięci).

### Faza 2: Pamięć (Baza Danych)
- [ ] **Baza Danych:** Konfiguracja Neon Postgres.
- [ ] **Schema:** Stworzenie modeli `Chat`, `Message`, `Memory` w Prisma.
- [ ] **Persystencja:** Wdrożenie zapisu rozmów do bazy (`onFinish`).

### Faza 3: Zmysły (Narzędzia & MCP)
- [ ] **GitHub Tool:** Danie Lolkowi możliwości czytania i edytowania własnego kodu.
- [ ] **Web Search:** Dodanie narzędzia do szukania w internecie (Tavily).

### Faza 4: Czas i Autonomia
- [ ] **Inngest Setup:** Konfiguracja silnika zadań w tle.
- [ ] **Pętla Samonaprawcza:** Wdrożenie mechanizmu, gdzie Lolek sam sprawdza, czy jego kod działa.

---

## 5. Jak zacząć pracę (Dla Agenta)
1. Przeczytaj ten plik.
2. Sprawdź status w "Mapie Drogowej".
3. Przeczytaj ostatnie wpisy w `.memory/changelog/`.
4. Wykonaj zadanie.
5. Zostaw notatkę w `.memory/changelog/`.
