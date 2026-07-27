# Wdrożenie CI/CD — podsumowanie zmian (2026-07-27)

Jednorazowe podsumowanie tego, co zostało zrobione przy wdrażaniu CI/CD. To nie jest dokument "stanu obecnego" w rozumieniu `docs/README.md` (ten opisuje historię jednej sesji pracy, nie architekturę) — jeśli kiedyś przestanie być potrzebny jako kontekst, można go usunąć bez straty dla dokumentacji architektury. Bieżący opis pipeline'u pracy z CI/CD żyje w [`docs/architecture/ci-cd.md`](architecture/ci-cd.md).

## Co zostało dodane

- **`.github/workflows/ci.yml`** — 6 jobów uruchamianych na każdym PR i pushu do `main`: `backend-test` (pytest), `backend-lint` (ruff), `frontend-test` (vitest), `frontend-lint` (eslint + prettier), `frontend-typecheck` (tsc --noEmit), `frontend-build` (next build).
- **`package.json`** — nowy skrypt `typecheck`.
- **`backend/requirements.txt`** — dodany `ruff` jako linter.
- **`backend/pyproject.toml`** (nowy) — `[tool.ruff.lint] ignore = ["E712"]`, bo `.filter(Model.pole == True/False)` to wymagany idiom SQLAlchemy, nie literał bool do "poprawienia".
- **Ruleset na `main`** (GitHub → Rules → Rulesets) — wymaga PR-a i przejścia 6 wymienionych wyżej checków przed mergem. Bezpośredni push na `main` jest zablokowany.
- **Render**: `Auto-Deploy` ustawiony na "After CI checks pass" (natywny gating Render, odpytuje status checków z GitHuba) — bez potrzeby webhooka/deploy hooka wywoływanego z workflow.
- **Vercel**: bez zmian w konfiguracji — auto-deploy z GitHuba już istniał, teraz efektywnie bramkowany przez ruleset na `main` (skoro nic nie wejdzie do `main` bez zielonego CI).

## Odrzucone podejście: custom `deploy-backend` job

Pierwsza wersja `ci.yml` zawierała job `deploy-backend`, który po zmergowaniu do `main` odpalał `curl` do Render Deploy Hook URL (sekret `RENDER_DEPLOY_HOOK_URL`). Usunięty, bo zdublował się z natywnym "Deploy after CI checks pass" w Render — oba triggerowały deploy tego samego commitu. Zostawiliśmy tylko mechanizm natywny, prostszy i bez utrzymywania dodatkowego sekretu.

## Skutki uboczne — realne problemy naprawione po drodze

Uruchomienie ruff/eslint/prettier/`npm ci` po raz pierwszy na tym kodzie ujawniło kilka istniejących, niezwiązanych z CI błędów:

- **`eslint.config.js`** — `eslint-plugin-react-hooks` był zaimportowany, ale nigdy nie zarejestrowany w `plugins`/`rules`. Kod miał komentarze `eslint-disable-next-line react-hooks/exhaustive-deps` odwołujące się do nieistniejącej (dla ESLinta) reguły. Naprawione: plugin zarejestrowany, reguła ustawiona na `warn`.
- **`package-lock.json`** — niespójny sam ze sobą (`npm ci` failował na konfliktach wersji transitive deps typu `@emnapi/*`). Zregenerowany od zera.
- **`backend/service.py`** — martwy plik z uszkodzonym kodowaniem (nie-UTF-8), nic go nie importowało. Usunięty.
- **`backend/init_db.py`** — martwy skrypt (nic go nie wywołuje, deploy używa `alembic upgrade head`, nie tego). Usunięty. Po drodze złapany bug: `ruff --fix` usunął z niego import modeli, który był potrzebny jako side-effect (rejestracja w `Base.metadata` przed `create_all()`) — zanim usunęliśmy cały plik, ten konkretny fix trzeba było cofnąć ręcznie.
- **Wyciek klucza API Resend** — `src/app/api/contact/route.ts` miał hardkodowany fallback klucza Resend (`const apiKey = process.env.RESEND_API_KEY || 're_...'`). Klucz był już wcześniej w historii `main` na GitHubie. Usunięty z kodu, **zrotowany w panelu Resend**.
- **GitGuardian false positives** — 2 fałszywe alarmy na testowe mocki JWT (`src/test/mocks/authFixtures.ts`) i 3 na testowe hasła w `validation.test.ts` (dane wejściowe do testów `validatePassword`, nie prawdziwe hasła). Oznaczone jako false positive w GitGuardianie, kod bez zmian.

## Zweryfikowane

- 276/276 testów backendu przechodzi po wszystkich fixach.
- `ruff check backend/` czysty.
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run format:check` — wszystkie czyste.
- PR #5 (setup CI) i PR usuwający `deploy-backend` — oba zmergowane przez pełny flow (branch → PR → zielone CI → merge).
