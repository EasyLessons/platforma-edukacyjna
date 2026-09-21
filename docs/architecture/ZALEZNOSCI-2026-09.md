# Zależności — audyt i plan większych skoków (stan na 2026-09-22)

Dokument z audytu `npm audit` / `pip-audit` i listy podniesień wersji, które wymagają
osobnej pracy (skoki major / zmiany łamiące). Część "bez zmian łamiących" została zrobiona
w PR `chore/deps-audit`; reszta to plan. Kiedy któryś skok zostanie zrobiony, zaktualizuj
odpowiednią sekcję tutaj (albo usuń ją, gdy nic nie zostaje) — dokument opisuje stan
obecny, nie historię.

Jak powtórzyć audyt (bez ruszania `node_modules` i bez instalowania w repo):

```
# frontend / whiteboard-sync: kopia package*.json do katalogu tymczasowego, potem
npm audit --json
npm audit fix --package-lock-only        # bez --force
# backend: osobny venv z pip-audit
pip-audit -r backend/requirements.txt --format json
```

## 1. Frontend (`package.json`, Node 20, npm 10.8)

### npm audit — przed i po

| | critical | high | moderate | low | razem |
| --- | --- | --- | --- | --- | --- |
| przed | 0 | 1 | 0 | 0 | 1 |
| po `npm audit fix --package-lock-only` | 0 | 1 | 0 | 0 | 1 |

Jedyna podatność:

| Pakiet | Zainstalowana | Zakres podatny | Fix | Waga | Advisory |
| --- | --- | --- | --- | --- | --- |
| `pdfjs-dist` (zależność bezpośrednia) | 5.7.284 (`^5.4.530`) | `>=5.6.83 <6.2.108` | **6.2.108** (major) | high, CVSS 8.6 | [GHSA-hq66-cqwq-w95j](https://github.com/advisories/GHSA-hq66-cqwq-w95j) / CVE-2026-16633 |

- `npm audit fix --package-lock-only` **nic nie naprawia**: jedyna wersja z fixem to 6.x, poza
  zakresem `^5.4.530`, a npm nie robi downgrade'u. Jedyne, co zmienił w locku, to ponowne
  dopisanie wpisów `@tailwindcss/oxide-wasm32-wasi/node_modules/@emnapi/*` (ten sam desync
  Windows/Linux co w commicie `8ba658a`) — **lock nie został zmieniony w tym PR**.
- Charakter podatności: wykonanie JS z złośliwego PDF w kontekście domeny, gdy viewer ma
  `enableScripting` i brak CSP. Nasza ścieżka (`getDocument({ data })` → `page.render()` w
  `whiteboard-canvas.tsx` i `image-tool.tsx`) nie uruchamia viewera ani skryptów PDF, więc
  realne ryzyko jest niskie, ale audit będzie czerwony aż do skoku na 6.x (sekcja 4).
- Bez patcha w 5.x. Obejście "na już", gdyby CI wymagał zielonego auditu: przypiąć
  `pdfjs-dist` do `5.6.205` (ostatnia wersja poniżej zakresu podatnego) — to downgrade,
  nie rekomendowany; lepiej zrobić skok na 6.3.289 (ok. 1–2 h, patrz niżej).

### npm outdated (tylko to, co ma nowszy major)

Uwaga: `npm outdated` uruchomiony w repo pokazał przestarzały cache (`pdfjs-dist latest
5.6.205`, `@supabase/supabase-js latest 2.109.0`); wersje poniżej sprawdzone `npm view`.

| Pakiet | Zainstalowana | Najnowsza | Uwagi |
| --- | --- | --- | --- |
| `next` | 16.3.5 | 16.3.5 | brak 17; Vercel zapowiedział out-of-band security release 16.3.6 na 22.09 — o 23:30 jeszcze nie było na registry. Sprawdzić `npm view next dist-tags` i podnieść lock (`^16.0.8` to obejmuje). |
| `react` / `react-dom` | 19.1.0 (pin) | 19.3.0 | sekcja 4 |
| `eslint` / `@eslint/js` | 9.39.5 | 10.11.0 / 10.0.1 | ESLint 9 EOL 2026-08-06; sekcja 4 |
| `vitest` / `@vitest/*` | 4.1.11 | 5.0.1 | wymaga Node ≥22.12; sekcja 4 |
| `jsdom` | 25.0.1 | 30.1.0 | wymaga Node 22/24; sekcja 4 |
| `typescript` | 5.9.3 | 7.0.2 (6.0.x pośrednie) | sekcja 4 |
| `@types/node` | 20.19.43 | 26.6.2 (dla Node 24: 24.13.6) | razem z Node |
| `pdfjs-dist` | 5.7.284 | 6.3.289 | sekcja 4 (security) |
| `@hocuspocus/provider` | 2.15.3 | 4.7.0 | strefa Bartka (Yjs) — nie ruszać bez niego |
| `lucide-react` | 0.548.0 | 1.47.0 | zmiany nazw ikon; sprawdzić przy okazji |
| `katex` | 0.16.47 | 0.18.7 | |
| `vite-tsconfig-paths` | 5.1.4 | 6.1.1 | |
| `@react-oauth/google` | 0.12.2 | 0.13.5 | |
| `lint-staged` | 17.5.1 | (latest tag 16.4.0) | bez zmian |

`npm` ostrzega `EBADENGINE`: `@supabase/*@2.116.0` wymaga Node ≥22, a projekt/CI jest na
Node 20 (EOL od 2026-04-30). To argument za skokiem na Node 24 przed resztą (sekcja 4).

## 2. whiteboard-sync (`whiteboard-sync/package.json`, strefa Bartka)

`npm audit`: **0 podatności** (critical 0 / high 0 / moderate 0 / low 0).
Zainstalowane: `@hocuspocus/server` 2.15.3, `@hocuspocus/extension-database` 2.15.3,
`yjs` 13.6.32, `tsx` 4.23.13, `typescript` 5.9.3, `@types/node` 20.19.43. Nic nie zmieniano.

## 3. Backend (`backend/requirements.txt`, Python 3.12)

Plik pinuje wszystko `==`, ale nie jest pełnym freeze'em (np. `pyasn1-modules`, `cachetools`
od `google-auth`, `typing-extensions` od `resend` przychodzą bez pinu). CI robi zwykłe
`pip install -r requirements.txt`.

### pip-audit — przed i po (pip-audit 2.10.1, bazy PyPI + OSV)

| | wpisy pip-audit | unikalne CVE/PYSEC | pakiety |
| --- | --- | --- | --- |
| przed | 105 | 58 | 16 |
| po (ten PR) | 34 | 19 | 7 |

### Co podniesiono w tym PR (ten sam major, wersja zamykająca podatność, testy zielone)

| Pakiet | Było | Jest | Zamknięte | Uwagi |
| --- | --- | --- | --- | --- |
| `click` | 8.3.0 | 8.3.3 | CVE-2026-7246 (command injection w `click.edit()`) | |
| `cryptography` | 46.0.3 | 46.0.7 | CVE-2026-26007, CVE-2026-34073, CVE-2026-39892 | zostają 4 wymagające 48/49/50 (major) |
| `ecdsa` | 0.19.1 | 0.19.2 | CVE-2026-33936 (DER parsing) | zostaje CVE-2024-23342 (Minerva) — bez fixa upstream |
| `idna` | 3.11 | 3.15 | CVE-2026-45409 | |
| `Mako` | 1.3.10 | 1.3.12 | CVE-2026-44307 (traversal na Windows) | |
| `pyasn1` | 0.6.1 | 0.6.4 | CVE-2026-23490, -30922, -59884, -59885, -59886 (DoS) | |
| `python-dotenv` | 1.0.0 | 1.2.2 | CVE-2026-28684 (`set_key` symlink) | |
| `python-jose` | 3.3.0 | 3.5.0 | CVE-2024-33663, CVE-2024-33664 | 3.4.0 odpada (wymaga `pyasn1<0.5`); zostaje CVE-2024-29370 (`jwe.decrypt`, nie używamy JWE, brak fixa) |
| `python-multipart` | 0.0.6 | 0.0.32 | 9 CVE (ReDoS, DoS, traversal, Content-Length) | import w Starlette 0.27 idzie przez shim `multipart` — działa, `PendingDeprecationWarning` |
| `urllib3` | 2.5.0 | 2.7.0 | CVE-2025-66418, CVE-2025-66471, CVE-2026-21441, CVE-2026-44431 | |
| `authlib` | 1.3.1 | 1.6.12 | 10 CVE (JWS/JWE, CSRF, padding oracle) | **brak importu `authlib` w `backend/`** — kandydat do usunięcia z requirements (decyzja Patryka) |

Weryfikacja: świeży venv z nowego `requirements.txt` → `pip check` czysty, `pytest tests/`
**334 passed**, `ruff check .` czysty, `pip-audit` jak w tabeli.

### Co zostaje (wymaga skoku major albo nie ma fixa)

| Pakiet | Wersja | Otwarte | Fix w | Dlaczego nie teraz |
| --- | --- | --- | --- | --- |
| `starlette` | 0.27.0 | 7: CVE-2024-47874, CVE-2025-54121, **CVE-2026-48710 (Host header → `request.url`, w CISA KEV)**, CVE-2026-48817, CVE-2026-48818, CVE-2026-54282, CVE-2026-54283 | 0.40 / 0.47.2 / 1.0.1 / 1.1.0 / 1.3.0 / 1.3.1 | FastAPI 0.104.1 pinuje `starlette>=0.27,<0.28` — bez skoku FastAPI nie da się załatać. **Najpilniejsze** z całej listy. |
| `fastapi` | 0.104.1 | 1: CVE-2024-24762 | 0.109.1 | to ta sama luka co w `python-multipart` (już zamknięta przez 0.0.32); FastAPI tylko podniósł minimalną wersję. Formalnie znika po skoku FastAPI. |
| `anyio` | 3.7.1 | 2: CVE-2026-63374, CVE-2026-64847 | 4.14.2 | FastAPI 0.104.1 pinuje `anyio<4`. |
| `requests` | 2.31.0 | 3: CVE-2024-35195, CVE-2024-47081, CVE-2026-25645 | 2.32.0 / 2.32.4 / 2.33.0 | `resend==0.8.0` pinuje `requests==2.31.0` na sztywno; luzuje to dopiero `resend` 2.x (`requests>=2.31.0`) — skok major `resend` 0.8 → 2.47. `import resend` jest tylko w `backend/core/email/client.py`. |
| `cryptography` | 46.0.7 | 4: CVE-2026-69247, -69248, -69249, GHSA-537c-gmf6-5ccf (OpenSSL w wheelu) | 48.0.1 / 49.0.0 / 50.0.0 | major; dotyczy PKCS7 i walidacji łańcuchów X.509, których nie używamy. Sprawdzić, czy `python-jose`/`authlib` zniosą 50.x. |
| `ecdsa` | 0.19.2 | 1: CVE-2024-23342 (Minerva, timing) | brak | upstream uznaje za "won't fix"; realne wyjście = odejść od `python-jose` (ciągnie `ecdsa`) na PyJWT. |
| `python-jose` | 3.5.0 | 1: CVE-2024-29370 (`jwe.decrypt` DoS) | brak | nie używamy JWE; kandydat do zamiany na PyJWT (sekcja 5). |
| `pytest` | 8.4.2 | 1: CVE-2025-71176 (`/tmp/pytest-of-*` na Unix) | 9.0.3 | dev-only, major; razem z `pytest-asyncio` (sekcja 4). |

## 4. Większe skoki — plan (NIE robione w tym PR)

Szacunki dla obecnej wielkości projektu (backend ~30 endpointów / 334 testów, frontend ~40
route'ów / ~200 plików testowych). Każdy krok = osobna gałąź i PR, po każdym pełny zestaw
`typecheck + lint + test` (front) / `pytest + ruff` (backend).

### 4.1 Backend

| # | Pakiet | Obecna → docelowa | Zmiany łamiące (skrót) | Praca | Ryzyko |
| --- | --- | --- | --- | --- | --- |
| B1 | `httpx` (testy) | 0.27.0 → 0.28.1 | usunięte `app=` (→ `transport=httpx.ASGITransport(app=app)`), `proxies=`→`proxy=`, `params={}` nadpisuje zamiast scalać. Pakiet `httpx` nie ma nowszych wydań, następca `httpx2` — osobna decyzja. [CHANGELOG](https://github.com/encode/httpx/blob/master/CHANGELOG.md) | 0.5–1 h | niskie |
| B2 | `fastapi` + `starlette` + `anyio` **razem** | 0.104.1 → 0.141.1, 0.27.0 → 1.6.0, 3.7.1 → 4.15.1 | Rozdzielenie nie ma sensu (FastAPI pinuje Starlette, FastAPI 0.104 pinuje anyio<4). Sprzężenie FastAPI↔Starlette: 0.109 `>=0.35,<0.36`, 0.115 `<0.39`, 0.120 `>=0.40,<0.49`, 0.128.3 `<1.0`, 0.133 obsługa 1.x, 0.134 `>=0.46`. Pydantic: mamy v2, ale 0.128 usuwa wsparcie v1 i od 0.135.2 `pydantic>=2.9` (mamy 2.10.4 OK); jedno legacy `class Config:` w `api/v1/whiteboard/schemas.py` → `ConfigDict`. `lifespan` już jest (Starlette 1.0 usunął `on_event`, FastAPI 0.128.3 reimplementuje je u siebie). Zależności z `yield`: 0.106 zasoby po `yield` niedostępne w BackgroundTasks; 0.110 `except` bez `raise` = leak; 0.118 kod po `yield` znów po wysłaniu odpowiedzi — przejrzeć `get_db`/sesje SQLAlchemy. 0.112 `pip install fastapi` bez uvicorn (mamy pin jawny). 0.115 modele Query/Header. 0.132 strict `Content-Type` dla JSON (422 bez `application/json`; `strict_content_type=False`) — ryzyko dla testów/frontu. 0.137 `app.routes` to drzewo, nie płaska lista. anyio 4: wyjątki z TaskGroup jako `ExceptionGroup`, `fail_after()` sync CM, `start_soon()`. Starlette: 0.43 `allow_redirects`→`follow_redirects` w TestClient; 0.45 `ExceptionMiddleware` import z `starlette.middleware.exceptions`; 0.46 `max_file_size`→`spool_max_size`; 1.0 usunięte dekoratory `@app.route/on_event` (dla FastAPI nieistotne). Opcjonalny etap pośredni: FastAPI 0.115.x. Linki: [release notes FastAPI](https://fastapi.tiangolo.com/release-notes/), [0.106](https://github.com/fastapi/fastapi/releases/tag/0.106.0), [0.110](https://github.com/fastapi/fastapi/releases/tag/0.110.0), [0.118](https://github.com/fastapi/fastapi/releases/tag/0.118.0), [0.128](https://github.com/fastapi/fastapi/releases/tag/0.128.0), [0.132](https://github.com/fastapi/fastapi/releases/tag/0.132.0), [0.137](https://github.com/fastapi/fastapi/releases/tag/0.137.0), [Starlette release notes](https://github.com/Kludex/starlette/blob/main/docs/release-notes.md), [GHSA-86qp-5c8j-p5mr](https://github.com/advisories/GHSA-86qp-5c8j-p5mr), [anyio versionhistory](https://anyio.readthedocs.io/en/stable/versionhistory.html) | 4–8 h | średnie (security: pilne) |
| B3 | `python-multipart` | 0.0.32 (już) | po B2 zniknie shim `multipart` — nic do zrobienia, o ile nie importujemy `multipart` sami (nie importujemy) | 0 | — |
| B4 | `uvicorn` | 0.24.0 → 0.53.0 | 0.33 usunięty watchgod; 0.36 usunięte `Config.setup_event_loop()`; **0.50 `--ws auto` → `websockets-sansio`** (przetestować WebSockety tablicy / Yjs albo wymusić `--ws websockets`). [release notes](https://github.com/encode/uvicorn/blob/master/docs/release-notes.md) | 0.5–1 h | niskie (średnie przy WS) |
| B5 | `resend` + `requests` | 0.8.0 → 2.47.0, 2.31.0 → 2.34.2 | `resend` 2.x: nowe API (`resend.Emails.send(params)` z typowanym dict, `typing-extensions`); sprawdzić `core/email/client.py`. Dopiero to odblokowuje `requests` (3 CVE). [resend-python releases](https://github.com/resend/resend-python/releases) | 1–2 h | niskie |
| B6 | `pytest-asyncio` | 0.21.1 → 1.4.0 | 1.0 **usuwa fixture `event_loop`** (każde `def event_loop()` w conftest do wyrzucenia), `scope=`→`loop_scope=`, dodać `asyncio_default_fixture_loop_scope` do konfiguracji. Zrobić PRZED pytest 9 (1.4 działa z pytest 8.4). [changelog](https://pytest-asyncio.readthedocs.io/en/latest/reference/changelog.html) | 1–3 h | średnie |
| B7 | `pytest` | 8.4.2 → 9.1.1 | `PytestRemovedIn9Warning` → błędy: testy sync z async fixture = ERROR, marki na fixture'ach = błąd, `importorskip` tylko `ModuleNotFoundError`, usunięte `fspath`. Najpierw `-W error::PytestRemovedIn9Warning` na 8.4.2. [changelog](https://docs.pytest.org/en/stable/changelog.html), [deprecations](https://docs.pytest.org/en/stable/deprecations.html) | 1–2 h | niskie/średnie |
| B8 | `SQLAlchemy` | 2.0.36 → 2.0.54 | same bugfixy, bez zmian zachowania. **2.1 tylko rc** (2026-09-08): Py≥3.11, `greenlet` opcjonalny, autoflush przy każdym execute, `filter_by()` po wszystkich FROM, psycopg3 domyślnie — odłożyć do finalnego wydania. [changelog 2.0](https://docs.sqlalchemy.org/en/20/changelog/changelog_20.html), [migration 2.1](https://docs.sqlalchemy.org/en/21/changelog/migration_21.html) | 0.5 h | niskie |
| B9 | `cryptography` | 46.0.7 → 50.0.1 | major; zamyka 4 pozostałe CVE (PKCS7, X.509). Sprawdzić peer `python-jose`/`authlib` (albo najpierw sekcja 5). [changelog](https://cryptography.io/en/latest/changelog/) | 0.5 h | niskie |

Kolejność: B1 → B2 (jeden PR, security) → B4 → B5 → B6 → B7 → B8/B9. Razem ~9–17 h,
główny koszt B2 i B6.

### 4.2 Frontend

| # | Pakiet | Obecna → docelowa | Zmiany łamiące (skrót) | Praca | Ryzyko |
| --- | --- | --- | --- | --- | --- |
| F0 | `next` | 16.3.5 → 16.3.6 | tylko security fix (GHSA-vcvr-r3jv-pc5j, upstream dep), gdy pojawi się na `latest`; mieści się w `^16.0.8` → tylko lock. [nextjs.org/blog](https://nextjs.org/blog) | 0.5 h | niskie |
| F1 | Node | 20 → 24 (`ci.yml`, `Dockerfile`, `engines`, `.nvmrc`) + `@types/node` 20 → 24.13.6 | Node 20 EOL 2026-04-30. Minimalne: Vitest 5 `^22.12`, jsdom 30 `^22.22.2 \|\| ^24.15`, pdfjs-dist 6 `>=22.13`, `@supabase/*` `>=22`. Prerekwizyt dla F3–F5. [Node schedule](https://github.com/nodejs/Release/blob/main/schedule.json) | 1–2 h | niskie |
| F2 | `pdfjs-dist` | 5.7.284 → 6.3.289 | zamyka CVE-2026-16633. 6.0 `[api-major]`: `getDocument()` wymaga obiektu parametrów (mamy `{ data }` OK), **usunięte `PDFDocumentProxy.destroy()`** → `loadingTask.destroy()` (sprawdzić oba miejsca użycia), wyższe minimalne przeglądarki. Worker bez zmian: `build/pdf.worker.min.mjs` na jsdelivr; `getViewport`/`render` bez zmian. [v6.0.227](https://github.com/mozilla/pdf.js/releases/tag/v6.0.227), [advisory](https://github.com/advisories/GHSA-hq66-cqwq-w95j) | 1–2 h | niskie |
| F3 | `react` / `react-dom` / `@types/react*` / `@testing-library/react` | 19.1.0 → 19.3.0 (lockstep), TL 16.3.0 → 16.3.3 | 19.2: prefiks `useId` `«r»`→`_r_` (snapshoty), batching Suspense w SSR. 19.3: `<ViewTransition>`, Fragment refs, StrictMode podwójnie odpala efekty przy hydratacji; brak udokumentowanych breaking changes. App Router bundluje własny React canary — wersja z npm dotyczy głównie testów. [19.2](https://react.dev/blog/2025/10/01/react-19-2), [19.3](https://react.dev/blog/2026/09/09/react-19-3) | 1–3 h | niskie |
| F4 | `jsdom` | 25.0.1 → 30.1.0 | 27: silnik selektorów `nwsapi`→`@asamuzakjp/dom-selector`, UA stylesheet z HTML Standard (inne `getComputedStyle`), `VirtualConsole.sendTo`→`forwardTo`; 29: własny CSSOM; 30: Node 22.22/24.15+. Robić osobno przed Vitest, żeby izolować regresje. [releases](https://github.com/jsdom/jsdom/releases) | 1–3 h | niskie/średnie |
| F5 | `vitest` + `@vitest/coverage-v8` + `@vitest/ui` | 4.1.11 → 5.0.1 | Node ≥22.12; `clearMocks: true` domyślnie; `vi.mock`/`vi.hoisted` tylko na top-level modułu (inaczej throw); usunięte `test.sequential`; nieawaitowane `.resolves/.rejects` = FAIL; `toThrow("")` dopasowuje każdy błąd; usunięte entry `vitest/reporters|coverage|...`; coverage `include/exclude` względne; artefakty w `.vitest/` (dodać do `.gitignore`). Przy ~200 plikach największy koszt to `clearMocks` i `vi.mock` w funkcjach. [migration](https://vitest.dev/guide/migration.html), [blog 5](https://vitest.dev/blog/vitest-5) | 4–8 h | średnie |
| F6 | `eslint` + `@eslint/js` | 9.39.5 → 10.11.0 | eslintrc usunięty na twardo (`FlatESLint`/`LegacyESLint`, `ESLINT_USE_FLAT_CONFIG`, `/* eslint-env */`); lookup configu od katalogu pliku; JSX tworzy referencje scope (zmienia `no-unused-vars`); nowe reguły w `recommended`: `no-unassigned-vars`, `no-useless-assignment`, `preserve-caught-error`; usunięte `context.getFilename/getSourceCode`. `@eslint/eslintrc` jest "frozen" — usunąć i przepisać `eslint.config.js` na `defineConfig([...nextVitals, ...nextTs])` z `eslint-config-next/core-web-vitals` + `/typescript` (16.3.5 ma peer `eslint >=9`; `eslint-plugin-react-hooks` 7.1.1 peer `^10` OK). [migrate-to-10](https://eslint.org/docs/latest/use/migrate-to-10.0.0), [blog](https://eslint.org/blog/2026/02/eslint-v10.0.0-released/) | 2–4 h | średnie |
| F7 | `typescript` | 5.9.3 → 6.0.x (7.0 odłożyć) | 6.0: nowe defaulty `strict`, `module: esnext`, `target: es2025`, **`types: []`** (wpisać jawnie `"types": ["node", ...]`), `libReplacement: false`; deprecacje (błąd bez `"ignoreDeprecations": "6.0"`): `baseUrl` (→ `paths` względne), `moduleResolution node10`, `esModuleInterop: false`. 7.0 (port na Go): to samo usunięte na twardo, **brak JS API do 7.1 (plan: październik 2026)** → `typescript-eslint` 8.70 ma peer `<6.1` i nie działa z TS 7. Next 16.3 wspiera TS 7 przez `experimental.useTypeScriptCli`. [TS 6.0](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/), [TS 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), [typescript-eslint #12518](https://github.com/typescript-eslint/typescript-eslint/issues/12518) | 6.0: 2–4 h; 7.0: 1–2 h | 6.0: średnie; 7.0: wysokie |

Kolejność: F0 (od razu) → F1 → F2 (security) → F3 → F4 → F5 → F6 → F7 (6.0; 7.0 dopiero
gdy typescript-eslint wyda major z obsługą TS 7). Razem ~15–30 h, największy koszt F5.
`@hocuspocus/provider` 2.x → 4.x zostaje w gestii Bartka (razem z `whiteboard-sync`).

## 5. Kandydaci do refaktoru zależności (do decyzji)

- `authlib==1.6.12` — brak importu w `backend/`; usunąć z `requirements.txt` (−10 pozycji w
  audycie na przyszłość, zero ryzyka, o ile nie planujemy OAuth serwera).
- `python-jose` (+ `ecdsa`, `rsa`, `pyasn1`) → **PyJWT** (`pyjwt[crypto]`): python-jose ma
  dwa CVE bez fixa, a `ecdsa` "won't fix" Minerva. Użycie: `api/v1/auth/utils.py`,
  `api/v1/auth/dependencies.py` (`jwt.encode/decode`, `JWTError`). Szacunek 1–2 h, −4 pakiety.
- `passlib==1.7.4` + `bcrypt==4.0.1` — passlib nie jest rozwijany (ostatnie wydanie 2020),
  `bcrypt` jest trzymany na 4.0.x, bo passlib 1.7.4 czyta `bcrypt.__about__` i z bcrypt ≥4.1 loguje błąd wersji. Zamiana na samo
  `bcrypt` (≈10 linii) odblokuje aktualizacje `bcrypt`.
- `requests` używany tylko przez `resend` i `google-auth` — po B5 nie ma po co pinować go
  jawnie.
