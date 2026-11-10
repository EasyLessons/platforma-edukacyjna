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
9. **Silnik tablicy** — Excalidraw w `src/_new/features/board-engine/`, opisany w `stack.md`, `pipelines.md` §2–2d i `ADR-silnik-tablicy.md`. Dawne dokumenty o własnym silniku canvasowym (`docs/ai-context/whiteboard/*`) zostały usunięte razem z nim w etapie F (11.2026).
10. **`docs/testing.md`** — jak wygląda pokrycie testami (backend, frontend, `whiteboard-sync`) i jak uruchomić testy E2E (Playwright, tablica na Excalidraw na pełnym stosie).
11. **`docs/migration-status.md`** — stan migracji na architekturę feature-based i silnik Excalidraw: co JEST, co zostało (rename `_new`). Sprawdź to **zanim** zaczniesz przenosić coś w folderze `src/_new`.
12. **`docs/roadmap.md`** — zaplanowane funkcje, które jeszcze nie mają kodu (płatności Stripe, etap F, infrastruktura płatna, usunięcie konta, pomysły).
13. **`docs/known-issues.md`** — realne buble znalezione w czasie pracy/testów (nie mylić z migracją ani roadmapą), z priorytetem i analizą przyczyny.
14. **`docs/architecture/REFAKTOR-PLAN.md`** — zatwierdzony plan refaktoru struktury (docelowe drzewo, etapy jako małe PR-y, kolejność względem pracy równoległej, decyzje). Czytaj przed każdym PR-em przenoszącym pliki.
15. **`docs/architecture/WARSTWY-PROJEKT.md`** — projekt warstw tablicy (na wierzch / na spód / wyżej / niżej): gdzie siedzi kolejność elementów (`_index` w Yjs), model, API, UI, lista zmian w plikach Yjs do uzgodnienia z Bartkiem, szacunek.
16. **`docs/architecture/ZALEZNOSCI-2026-09.md`** — audyt zależności (`npm audit` front + whiteboard-sync, `pip-audit` backend), co zostało załatane, co wymaga skoku major (FastAPI/Starlette, Next/React/Vitest/ESLint/TS, pdfjs-dist) z listą zmian łamiących, szacunkiem i kolejnością. Czytaj przed podnoszeniem wersji czegokolwiek.
17. **`docs/architecture/ADR-silnik-tablicy.md`** — decyzja o silniku tablicy (własny vs Excalidraw vs tldraw): stan zmierzony, licencje, koszt migracji w dniach, warunki dla prototypu `proto/excalidraw-yjs`, pytania do Patryka i Bartka; na końcu plan płatności (Stripe + polskie faktury — co bierzemy gotowe, co piszemy sami).
18. **`docs/security/AUDYT-2026-09.md`** — audyt bezpieczeństwa (znaleziska SEC-xx z dowodami `plik:linia`, plan PR-ów naprawczych, akcje dla Patryka). Obok: `rls-board-images.sql` i `rls-realtime.sql` — gotowe polityki do uruchomienia w Supabase SQL Editor.
19. **`docs/plan-subskrypcje.md`** — plany Free/Premium (bez płatności): tabela `user_plans`, limity w jednym miejscu (2 przestrzenie / 3 tablice w przestrzeni / 1000 elementów), liczenie wg planu właściciela przestrzeni, grandfathering, wyścig `FOR UPDATE`, `GET /plans/me`, SQL do ręcznego nadania Premium.

## Zasada utrzymania

Ten katalog opisuje **stan obecny**, nie historię zmian — nie trzymamy archiwum starych refaktorów jako osobnych plików. Kiedy coś się zmienia w architekturze, odpowiedni plik w `docs/architecture/` jest aktualizowany w tym samym kroku co kod, nie później. Jeśli dokument i kod się rozjadą, dokument jest źle utrzymany, nie kod — popraw dokument.
