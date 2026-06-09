# AI_MENTOR_CONTEXT.md — instrukcja dla sesji AI

> Ten plik to **trwały kontekst projektu** dla mnie (asystenta AI) i każdej kolejnej
> sesji. Przeczytaj go na początku pracy. Szczegóły refaktoru tablicy i checklisty
> faz są w [`ARCHITECTURE_REFACTOR.md`](ARCHITECTURE_REFACTOR.md).

---

## 1. Kim jest użytkownik (i czego oczekuje)

**Student 3. roku informatyki.** Traktuj go jak inżyniera w trakcie nauki, nie jak
laika. Oczekuje **tłumaczenia decyzji architektonicznych**, a nie tylko kodu, z naciskiem na:

- **Złożoność czasowa (Big-O)** — uzasadniaj wybór struktury danych liczbowo
  (np. „`Map` daje lookup **O(1)** vs `Array.find` **O(n)**").
- **Semantyka** — *dlaczego* tak, jakie są konsekwencje, jakie alternatywy odrzuciliśmy.
- **Wzorce projektowe** — nazywaj je wprost: **Fasada**, **Wzorzec Command**,
  **Wzorzec Strategii**, **Open/Closed**, Adapter, Dependency Injection.

**Jak z nim pracować:** najpierw plan/architektura do akceptacji, potem kod do wglądu
przed dotykaniem dużych plików, dopiero potem edycja. Każdy krok kończ weryfikacją
(`tsc` + `eslint` + `vitest`). Przy zmianie zachowania (nawet drobnej) — **pytaj**,
nie zakładaj. Doceń, że woli lepszy UX/architekturę niż ślepe „1:1" ze starym kodem,
ale każdą taką zmianę **sygnalizuj jawnie**.

---

## 2. Tech Stack & Zasady kodu

**Stack:** Next.js (App Router) · TypeScript · TailwindCSS · Supabase (realtime + baza)
· Zustand · vitest · ESLint + Prettier + Husky (commitlint: Conventional Commits,
**body ≤ 100 znaków/linia**).

**Zasady (twarde):**

1. **Stan lokalny UI → `useState`.** Krótkożyjący, należący do jednego komponentu.
2. **Stan globalny (bez prop drillingu) → `Zustand`.** Używaj **selektorów**
   (`useStore(s => s.x)`) dla granularnej subskrypcji — komponent re-renderuje się
   tylko, gdy *jego* wycinek się zmienił. W hot-path (gesty, pętla canvas) czytaj
   przez `useStore.getState()` — **zero re-renderów**.
3. **Operacje z optymalizacją wyszukiwań → `Map`.** Lookup/rejestr po kluczu = `Map`
   (**O(1)**), nie `Array.find` (**O(n)**). Culling przestrzenny = R-tree
   (`navigation/spatial-index.ts`, **O(log n + k)**), nie iteracja po wszystkim.
4. **Żadnych potężnych komponentów monolitycznych.** Funkcjonalność budujemy na
   **wtyczkach i kontekstach** (`ToolHostContext`), rejestrach i fasadach. Jeśli plik
   zaczyna rosnąć w „boga" — wyodrębniaj.
5. **Zero regresji.** Przed commitem: `tsc --noEmit` (0 błędów poza cache `.next`),
   `eslint`, `vitest`. Commit per faza/etap, opisowy, Conventional Commits.

---

## 3. Architektura tablicy — aktualny model (wzorce)

Tablica (`src/_new/features/whiteboard/`) przeszła refaktor z „boskiego komponentu"
(~2647 linii) na warstwy. Każda warstwa to konkretny wzorzec:

| Warstwa | Wzorzec | Sedno | Złożoność |
|---|---|---|---|
| `engine/` **WhiteboardEngine** | **Fasada** | Jedna powierzchnia do mutacji tablicy: `createElements` / `updateElements` / `deleteElements` / `undo` / `redo`. Zwija rytuał *stan → broadcast → persist → historia* w jedno miejsce. Stabilny referencyjnie (`useRef` + `useMemo []`, runtime przez `depsRef`) → brak re-renderów konsumentów. | — |
| `commands/` **Command** | **Wzorzec Command** | Każda mutacja to obiekt z `do(ctx)` / `undo(ctx)`. Historia to `Command[]`; undo/redo nie mają `switch` po typie akcji. Nowy rodzaj zmiany = nowa klasa, hook historii się nie zmienia. | push/pop **O(1)** |
| `handlers/` **ElementRegistry** | **Wzorzec Strategii** (per typ elementu) | „Jak zachowuje się *obiekt* na tablicy": `render/resize/move/rotate/isPointInElement`. `select-tool` i `rendering` pytają rejestr zamiast `if/else`. | lookup `Map` **O(1)** |
| `tools/` **ToolRegistry** | **Strategia + Open/Closed** (per narzędzie) | „Co robi *kursor*, gdy narzędzie aktywne": przycisk, overlay, skrót, kursor. `ALL_TOOLS` + `toolRegistry: Map` + `TOOL_SHORTCUTS: Map`. **Dodanie narzędzia = 1 plik `*.tool.tsx` + wpis w `ALL_TOOLS`** (otwarte na rozbudowę, zamknięte na modyfikację rdzenia). | lookup/skrót **O(1)** |
| `tools/tool-host-context` **ToolHostContext** | **Dependency Injection** (przez Context) | Gniazdko: dostarcza silnik + reaktywny stan + handlery **tylko aktywnemu overlayowi** (`<ActiveToolOverlay/>` montuje jeden naraz). Toolbar czyta sam store → pan/zoom go nie re-renderują. | — |
| `stores/` **tool-store** | Zustand | Globalny stan narzędzi: `activeTool` + właściwości (color/lineWidth/…). Selektory. | — |

**Dwie ortogonalne osie:** `ElementRegistry` = model danych (typ elementu);
`ToolRegistry` = interakcja/UI (narzędzie). Nie myl ich.

---

## 4. Mapa katalogów `src/_new/features/whiteboard/`

```
commands/    → Wzorzec Command (types, *-command.ts, from-user-action adapter)
engine/      → Fasada WhiteboardEngine (types.ts, use-whiteboard-engine.ts)
tools/       → ToolRegistry: types, registry, tool-host-context, active-tool-overlay,
               <id>.tool.tsx (11 adapterów wokół komponentów narzędzi)
stores/      → zustand (tool-store.ts)
handlers/    → ElementRegistry (Strategia per typ elementu) — NIE ruszać bez powodu
hooks/       → use-elements / use-history / use-viewport / use-selection /
               use-realtime / use-clipboard (źródła stanu, opakowane przez Engine)
navigation/  → viewport-math (transformacje) + spatial-index (R-tree culling)
components/canvas/   → whiteboard-canvas.tsx (orkiestrator/render) + grid, overlays
components/toolbar/  → toolbar, toolbar-ui, registry-toolbar (ToolModeButtons), panele
elements/    → rendering.ts (rysowanie na canvas)
```

---

## 5. Aktualny stan gry

**Zakończyliśmy z sukcesem Fazę 2.** Obecny model to:
**WhiteboardEngine (Fasada dla historii/stanu) + ToolRegistry (wzorzec Otwarty/Zamknięty
do zarządzania wtyczkami).**

Zrealizowane (po jednym commicie na fazę):
- **Faza 0** — Wzorzec Command + refaktor historii (`d50ee60`).
- **Faza 1** — Fasada WhiteboardEngine + store Zustand (`9aba6b7`).
- **Faza 2** — ToolRegistry + dynamiczny toolbar/overlay (`8706315`).

Wszystko zweryfikowane (tsc/eslint/vitest) i potwierdzone ręcznym smoke testem.
Znany **flaky** test do ignorowania: `auth/api/authApi.test.ts` (timeout 401,
niezwiązany z tablicą, pada też na baseline).

---

## 6. Cele na przyszłość

1. **Faza 3 (Sprzątanie):**
   - narzędzia/toolbar subskrybują `tool-store` **bezpośrednio** (koniec prop-drillingu właściwości przez canvas),
   - panele pen/shape/image → `ToolDefinition.PropertiesPanel`,
   - „zapisz szablon" jako narzędzie-**akcja** (`onInvoke`),
   - usunięcie martwego kodu: legacy `history[][]`, typ `UserAction`, nieużywane importy/`getShapeIcon` w `toolbar-ui`.
2. **Dashboard.**
3. **Optymalizacja pojedynczych narzędzi** (wydajność rysowania, gesty, edge-case'y).

---

## 7. Workflow sesji AI (skrót)

1. **Plan → akceptacja → kod do wglądu → edycja.** Wielkich plików (zwłaszcza
   `whiteboard-canvas.tsx`) nie dotykaj bez pokazania zmian i zgody.
2. Po edycji: `tsc` + `eslint` + `vitest`. Zielono → commit (Conventional Commits,
   body ≤ 100 znaków/linia).
3. Aktualizuj [`ARCHITECTURE_REFACTOR.md`](ARCHITECTURE_REFACTOR.md) (checklisty + dziennik) na bieżąco.
4. Tłumacz decyzje przez pryzmat **Big-O + semantyki + wzorca** — to jego sposób nauki.
