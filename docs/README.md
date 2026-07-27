# Dokumentacja EasyLesson — start tutaj

Jedno miejsce prawdy o architekturze projektu. Jeśli zaczynasz tu pracę (człowiek albo AI) — czytaj w tej kolejności:

1. **`docs/ai-context/global-context.md`** — kontekst startowy (kim jesteśmy, jak pracujemy, stan projektu). Jeśli robisz to jako AI wdrażające się do pracy, zacznij od tego pliku.
2. **`docs/architecture/stack.md`** — cały stack technologiczny i kluczowe koncepty/wzorce, z uzasadnieniem dlaczego tak, nie inaczej.
3. **`docs/architecture/frontend-structure.md`** — struktura `src/` (routing vs logika, route groups, co gdzie szukać).
4. **`docs/architecture/backend-structure.md`** — struktura `backend/` i model danych (wszystkie tabele, relacje).
5. **`docs/architecture/auth.md`** — architektura logowania, stany zalogowany/niezalogowany, plan na subskrybenta.
6. **`docs/architecture/dashboard.md`** — funkcje i budowa panelu użytkownika.
7. **`docs/architecture/pipelines.md`** — jak dane przepływają przez system dla każdej ważnej operacji (logowanie, sync tablicy, powiadomienia, AI chat, voice chat, SmartSearch).
8. **`docs/architecture/ci-cd.md`** — jak pracujemy z `main` (branch → PR → CI → merge), co sprawdza `ci.yml`, jak to odpalić lokalnie przed pushem, co robić przy zablokowanym pushu przez sekret scanning.
9. **`docs/ai-context/whiteboard/`** — osobny, szczegółowy zestaw dokumentów o silniku tablicy (`canvas-architecture.md`, `how-to-add-tool.md`, `use-canvas-wheel-spec.md`) — zaglądaj tu dopiero przy pracy konkretnie nad tablicą.
10. **`docs/testing.md`** — jak wygląda pokrycie testami (backend + frontend).
11. **`docs/migration-status.md`** — co z migracji na architekturę feature-based zostało zrobione, co zostaje do zrobienia. Sprawdź to **zanim** zaczniesz zmieniać coś w `src/app/context/*` albo w folderze `src/_new`.
12. **`docs/roadmap.md`** — zaplanowane funkcje, które jeszcze nie mają kodu (na razie: subskrybent).
13. **`docs/known-issues.md`** — realne buble znalezione w czasie pracy/testów (nie mylić z migracją ani roadmapą), z priorytetem i analizą przyczyny.

## Zasada utrzymania

Ten katalog opisuje **stan obecny**, nie historię zmian — nie trzymamy archiwum starych refaktorów jako osobnych plików. Kiedy coś się zmienia w architekturze, odpowiedni plik w `docs/architecture/` jest aktualizowany w tym samym kroku co kod, nie później. Jeśli dokument i kod się rozjadą, dokument jest źle utrzymany, nie kod — popraw dokument.
