# 🔮 PROJEKT ZORDON (Lolek Core)

> **"To nie jest chatbot. To autonomiczny system operacyjny dla mojego życia cyfrowego."**

---

## 1. Misja i Filozofia

Ten projekt to coś więcej niż aplikacja. To budowa **"Drugiego Mózgu"** i **"Centrum Dowodzenia"**.
W przeciwieństwie do gotowych rozwiązań (jak ChatGPT w przeglądarce), **Zordon (Lolek)** ma posiadać:

1.  **Trwałą Pamięć:** Pamięta fakty i kontekst sprzed miesięcy (nie resetuje się po zamknięciu okna).
2.  **Sprawczość (Agency):** Może sam wykonywać zadania w tle (np. "sprawdzaj to co godzinę"), nawet gdy ja śpię.
3.  **Dostęp do Świata:** Posiada "ręce" (Tools), którymi dotyka moich plików, serwerów, maili i repozytoriów.

---

## 2. Manifest V2.0: Symbioza i Autopoiesis

### Typ Relacji: Symbioza
* **Ja (Użytkownik/Architekt):** Dostarczam wizję, logikę biznesową i ocenę jakości ("To działa słabo", "Zmień kolor na czerwony"). Nie jestem programistą w tradycyjnym sensie – jestem **Prompterem**.
* **Lolek (Inżynier/Wykonawca):** Zna składnię, biblioteki, obsługuje błędy i deployment. Jego zadaniem jest pisanie kodu i wdrażanie rozwiązań.

### Filar: Autopoiesis (Samotworzenie)
Lolek musi posiadać uprawnienia i narzędzia do edycji własnego kodu źródłowego. System opiera się na pętli sprzężenia zwrotnego (**Human-in-the-loop for Coding**):

1.  **Refleksja:** Lolek wie, jak jest zbudowany (ma dostęp do swojego repozytorium przez GitHub API i narzędzie `explore_self`).
2.  **Ewolucja:** Na Twoje polecenie tworzy nową gałąź (branch), wprowadza zmiany (np. w `route.ts`) używając narzędzia `propose_change` i wystawia Pull Request.
3.  **Weryfikacja:** Ty nie sprawdzasz średników. Wchodzisz na link **Preview Vercel**, sprawdzasz czy działa. Jeśli tak – mergujesz.

---

## 3. Architektura i Stack Technologiczny (Best Practices 2025)

Wybraliśmy te klocki, aby zapewnić skalowalność i autonomię:

### 🧠 MÓZG (AI Engine)
* **Technologia:** `Vercel AI SDK` (Core & UI).
* **Model:** `Google Gemini 1.5 Pro / 3.0` (via Vertex AI/Studio).
* **Dlaczego:** Vercel AI SDK to standard branżowy. Gemini posiada ogromne **okno kontekstowe**, kluczowe dla analizy całych projektów na raz.
    * **UWAGA:** Do definicji narzędzi (Tools) używamy standardowego API, które obsługuje **Function Calling/Tool Calling**, zgodnie z zaleceniami Vercel AI SDK.

### 💾 PAMIĘĆ (Database & Knowledge)
* **Technologia:** `Vercel Postgres (Neon)` + `Prisma ORM` + `pgvector`.
* **Dlaczego:** Serverless (płacimy za użycie). **`pgvector`** umożliwia **wyszukiwanie semantyczne (RAG)**, kluczowe dla pamięci długoterminowej i analizy wgranych dokumentów (PDF/Docs). Prisma pozwala Agentowi łatwo modyfikować strukturę bazy.

### 💅 TWARZ (Interface)
* **Technologia:** `Next.js App Router` + `Shadcn UI` + `Generative UI`.
* **Dlaczego:** Nowoczesny, profesjonalny wygląd "out-of-the-box". **Generative UI** pozwala Lolkowi generować wykresy i tabele w locie.

### 🔌 ZMYSŁY (Integrations)
* **Technologia:** `MCP (Model Context Protocol)`.
* **Dlaczego:** "USB dla AI". Używamy standardu, by łatwo podpinać GitHub, Google Drive, Slack bez pisania customowego kodu od zera.

### ⏰ CZAS (Background Tasks)
* **Technologia:** `Inngest`.
* **Dlaczego:** Pozwala Lolkowi żyć godzinami (długie zadania, research), usypiać się i budzić po wykonaniu zadania, nie blokując przeglądarki.

---

## 4. Protokoły Operacyjne

### A. Protokół Pamięci (Memory Protocol) 📝
**ZASADA ŻELAZNA:** System budowany jest iteracyjnie. Nie wolno wprowadzać zmian bez zostawienia śladu.

Po każdej sesji programistycznej, Agent ma obowiązek stworzyć/zaktualizować plik w katalogu `.memory/changelog/`:
* **Format:** `YYYY-MM-DD-opis-zmiany.md`
* **Treść:** Co zostało zrobione, dlaczego, i co jest następnym krokiem.

### B. Protokół Samorozwoju (Coding Protocol)
Agent (Lolek) nie pisze kodu w czacie do skopiowania. Agent używa narzędzi GitHub do:
1.  **`read_own_code`**: Analizy obecnego stanu.
2.  **`create_feature_branch`**: Utworzenia gałęzi dla nowej funkcjonalności.
3.  **`propose_code_change`**: Commitowania zmian bezpośrednio do repozytorium.

---

## 5. Mapa Drogowa (Masterplan)

Agencie, zaznaczaj `[x]` przy zrealizowanych punktach.

### 🚨 STATUS CRITICAL: Oczyszczanie
- [ ] **Usunięcie `fak-main.zip`:** Plik zawiera stary kod i zakłóca analizę. Należy go usunąć z repozytorium.

### Faza 0: Fundamenty Autonomii
- [ ] **Inicjalizacja:** Czysta struktura `.memory` i `changelog`.
- [ ] **Mózg V1 (route.ts):** Implementacja `app/api/chat/route.ts` z modelem Gemini.
- [ ] **Narzędzia Self-Dev:** Implementacja mocków/szkieletów narzędzi: `read_own_code`, `create_feature_branch`, `propose_code_change`.
- [ ] **Tool Calling/Function Calling:** Definicja pierwszych narzędzi (Tools) w `route.ts` przy użyciu Vercel AI SDK. To jest kluczowe dla nadania Lolkowi **sprawczości**.

### Faza 1: Twarz (UI)
- [ ] **Instalacja UI:** Wdrożenie `shadcn/ui` i szablonu Vercel Chatbot.
- [ ] **Interakcja:** Podpięcie modelu do UI, aby umożliwić rozmowę.

### Faza 2: Pamięć Długotrwała (Pgvector)
- [ ] **Neon Postgres & Rozszerzenie:** Włączenie rozszerzenia **`vector`** w bazie Neon Postgres.
- [ ] **Schema `pgvector`:** Aktualizacja schematu Prisma (model np. `Document` lub `Memory`), dodanie pola `Unsupported("vector")` do przechowywania osadzeń.
- [ ] **Persystencja Rozmów:** Zapis rozmów do bazy (`onFinish`).

### Faza 3: Zmysły (MCP & Integracje)
- [ ] **GitHub Tool (Live):** Pełna implementacja narzędzi do edycji kodu (zamiast mocków) – np. użycie Octokit/GitHub API.
- [ ] **Web Search:** Integracja z Tavily.
- [ ] **Przeglądarka (Playwright/Puppeteer):** Wdrożenie `Tool` o nazwie np. `browseWeb(url)` pozwalającego Lolkowi na realne przeglądanie stron internetowych i pobieranie danych.

### Faza 4: Czas i Pętla
- [ ] **Inngest:** Konfiguracja zadań w tle.
- [ ] **Pętla Samonaprawcza:** Mechanizm auto-weryfikacji kodu (Lolek weryfikuje własne zmiany).

---

## 6. Jak zacząć pracę (Instrukcja dla Agenta)

1.  **Przeczytaj ten plik.** Zrozum swoją rolę jako Autonomicznego Systemu Operacyjnego.
2.  **Sprawdź sekcję "STATUS CRITICAL"**. Jeśli `fak-main.zip` istnieje, zgłoś to lub zaproś do usunięcia.
3.  **Sprawdź "Mapę Drogową".** Zidentyfikuj aktualne, niezrealizowane zadanie.
4.  **Przeczytaj ostatnie wpisy w `.memory/changelog/`.** Złap kontekst.
5.  **Wykonaj zadanie** używając narzędzi (lub proponując zmiany w kodzie zgodnie z Protokołem Samorozwoju).
6.  **Zostaw notatkę** w `.memory/changelog/`.

---

## 7. Environment Variables

### Database Connection

# Recommended for most uses
DATABASE_URL=postgresql://neondb_owner:npg_jCnoW3hqtal2@ep-cool-queen-agrokii4-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require

# For uses requiring a connection without pgbouncer
DATABASE_URL_UNPOOLED=postgresql://neondb_owner:npg_jCnoW3hqtal2@ep-cool-queen-agrokii4.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require

# Parameters for constructing your own connection string
PGHOST=ep-cool-queen-agrokii4-pooler.c-2.eu-central-1.aws.neon.tech
PGHOST_UNPOOLED=ep-cool-queen-agrokii4.c-2.eu-central-1.aws.neon.tech
PGUSER=neondb_owner
PGDATABASE=neondb
PGPASSWORD=npg_jCnoW3hqtal2

# Parameters for Vercel Postgres Templates
POSTGRES_URL=postgresql://neondb_owner:npg_jCnoW3hqtal2@ep-cool-queen-agrokii4-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require
POSTGRES_URL_NON_POOLING=postgresql://neondb_owner:npg_jCnoW3hqtal2@ep-cool-queen-agrokii4.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require
POSTGRES_USER=neondb_owner
POSTGRES_HOST=ep-cool-queen-agrokii4-pooler.c-2.eu-central-1.aws.neon.tech
POSTGRES_PASSWORD=npg_jCnoW3hqtal2
POSTGRES_DATABASE=neondb
POSTGRES_URL_NO_SSL=postgresql://neondb_owner:npg_jCnoW3hqtal2@ep-cool-queen-agrokii4-pooler.c-2.eu-central-1.aws.neon.tech/neondb
POSTGRES_PRISMA_URL=postgresql://neondb_owner:npg_jCnoW3hqtal2@ep-cool-queen-agrokii4-pooler.c-2.eu-central-1.aws.neon.tech/neondb?connect_timeout=15&sslmode=require

# Neon Auth environment variables for Next.js
NEXT_PUBLIC_STACK_PROJECT_ID=****************************
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=****************************************
STACK_SECRET_SERVER_KEY=***********************
