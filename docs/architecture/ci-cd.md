# CI/CD — jak pracujemy z `main`

Od wdrożenia CI/CD (patrz `docs/ci-cd-migration-summary.md`) `main` jest chronione regułą (GitHub Ruleset). **Bezpośredni push na `main` jest zablokowany** — nawet dla właściciela repo. Każda zmiana musi przejść przez PR i zielone CI.

## Codzienny flow

```
git checkout main
git pull
git checkout -b <opisowa-nazwa-brancha>   # np. fix/auth-redirect, feat/board-export

# ... praca, commity ...

git push -u origin <nazwa-brancha>
# otwórz PR na GitHubie do main
# poczekaj na 6 zielonych checków CI
# merge przez UI GitHuba
# skasuj branch (przycisk na stronie PR albo `git branch -d <nazwa>` lokalnie)
```

Jeśli spróbujesz `git push` bezpośrednio na `main`, dostaniesz:
```
remote: error: GH013: Repository rule violations found for refs/heads/main.
remote: - Changes must be made through a pull request.
```
To nie błąd do obejścia — przenieś commit(y) na nowy branch (`git checkout -b <branch>` z aktualnego stanu, potem `git checkout main && git reset --hard origin/main` żeby zsynchronizować lokalnego `main`) i otwórz PR normalnie.

## Co sprawdza CI (`.github/workflows/ci.yml`)

Odpala się na każdym PR do `main` i na każdym pushu do `main`. Wymagane do mergu (ustawione w rulesecie):

| Job | Co robi | Odpowiednik lokalny |
|---|---|---|
| `backend-test` | `pytest tests/ -v` w `backend/` | to samo, z aktywnym venv |
| `backend-lint` | `ruff check .` w `backend/` | to samo |
| `frontend-test` | `npm run test:coverage` (vitest z pokryciem; failuje, gdy pokrycie spadnie poniżej `coverage.thresholds` w `vitest.config.ts` — progi podnosimy, nie obniżamy) | to samo |
| `frontend-lint` | `npm run lint` + `npm run format:check` | to samo |
| `frontend-typecheck` | `npm run typecheck` (`tsc --noEmit`) | to samo |
| `frontend-arch` | `npm run depcruise` (dependency-cruiser: granice importów `app -> _new/features -> _new/{shared,lib}`, brak cykli/sierot) | to samo |
| `frontend-build` | `npm run build` (sanity-check kompilacji) | to samo |
| `sync-typecheck` | `npx tsc --noEmit` w `whiteboard-sync/` | to samo |
| `frontend-audit` | `npm audit --omit=dev` na zależnościach produkcyjnych (dziś `--audit-level=critical` do czasu podbicia `pdfjs-dist` do 6.x, potem `high`); pełny audyt z dev tylko informacyjnie; `whiteboard-sync` osobno na `high` | `npm audit --audit-level=critical --omit=dev` |
| `backend-audit` | `pip-audit -r requirements.txt --strict` w `backend/`; podatności bez poprawki w obrębie naszego majora są wpisane z powodem w `backend/pip-audit-ignore.txt` (każdy wpis ma warunek usunięcia). Każda nowa podatność spoza listy = czerwony job | `pip install pip-audit`, potem komenda z joba |
| `gitleaks` | binarka `gitleaks` (bez licencji, w przeciwieństwie do `gitleaks-action` dla organizacji): commity z PR skanowane z twardym failem; cała historia tylko informacyjnie (`continue-on-error`) do czasu rotacji 4 starych wpisów i allowlisty w `.gitleaks.toml` | `gitleaks git --redact .` |

**Przed pushem warto odpalić to lokalnie**, żeby nie czekać na czerwone CI:
```
# backend (z venv aktywnym w backend/)
ruff check .
pytest tests/ -v

# frontend (z roota)
npm run lint
npm run typecheck
npm run test:coverage
npm run format:check
npm run depcruise
```

Jeśli `npm run lint`/`format:check` znajdzie coś do poprawy automatycznie:
```
npx eslint src --ext .js,.jsx,.ts,.tsx --fix
npx prettier --write "src/**/*.{ts,tsx,js,jsx,json,css,md}"
```

Backend analogicznie: `ruff check --fix .` — ale sprawdź diff przed commitem, `--fix` czasem usuwa importy, które są potrzebne dla efektu ubocznego (np. rejestracji modeli SQLAlchemy w `Base.metadata`), a ruff tego nie wie.

## Co się dzieje po mergu do `main`

- **Backend (Render)**: `Auto-Deploy` ustawiony na "After CI checks pass" — Render sam odpytuje status checków commitu na GitHubie i deployuje dopiero po ich zielonym świetle. Nie ma osobnego joba w `ci.yml` do tego — to konfiguracja po stronie Render, nie kod.
- **Frontend (Vercel)**: auto-deploy z GitHuba, bez zmian w konfiguracji Vercela. Gating działa "za darmo" dzięki temu, że nic nie wejdzie do `main` bez przejścia CI (ruleset).

## Sekret scanning — jeśli push zostanie zablokowany

GitHub Push Protection i GitGuardian skanują każdy push/PR pod kątem hardkodowanych sekretów.

- **Prawdziwy sekret w kodzie** — nie próbuj obchodzić. Usuń hardkodowaną wartość (przenieś do zmiennej środowiskowej), **zrotuj sekret** w usłudze źródłowej (nawet jeśli usuniesz go z kodu, stary już mógł wyciec przez historię gita), dopiero potem pushuj ponownie.
- **Fałszywy alarm** (np. testowy fixture wyglądający jak JWT albo testowe hasło w teście `validatePassword`) — oznacz w panelu narzędzia (GitHub → "It's used in tests" / GitGuardian → "False Positive"), nie zmieniaj kodu na siłę.

## Co jest poza zakresem (świadomie)

- Mypy/pyright dla backendu, pełny `eslint-config-next` — nieaktywne, bo kodebase nigdy nie było pod nie pisane; włączenie teraz zalałoby CI szumem. Osobna, przyszła decyzja.
- Realna baza Postgres/Redis w CI (`services:` w Actions) — testy celowo używają SQLite in-memory + fakeredis, wystarczające dziś.

## Luki (nie decyzje)

- `whiteboard-sync/` nie ma w CI żadnego kroku (typecheck/lint/testy) — do dodania, patrz `REFAKTOR-PLAN.md` (PR-A10).
- `dependency-cruiser` jest w devDependencies i ma konfigurację (`.dependency-cruiser.cjs`), ale nie jest uruchamiany w CI — reguły granic importów wchodzą w PR-A2 planu.
