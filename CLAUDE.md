# CLAUDE.md - EasyLesson (platforma-edukacyjna)

Czyta to kazda sesja Claude Code uruchomiona w tym repo. Nadrzedne zasady
(brak push, brak merge do main, raport sesji) sa w `..\..\CLAUDE.md` (Projekty_IT).
Pelna dokumentacja architektury jest w `docs/` - zacznij od `docs/README.md`.
NIE tworz rownoleglej dokumentacji obok `docs/`.

## Komendy (frontend, z katalogu glownego)

| Cel                | Komenda                    | Uwagi                                          |
| ------------------ | -------------------------- | ---------------------------------------------- |
| dev server         | `npm run dev`              | Next.js, http://localhost:3000                 |
| build produkcyjny  | `npm run build`            | sanity-check kompilacji, tak jak w CI          |
| lint               | `npm run lint`             | eslint na `src/`; warningi nie blokuja (0 err) |
| typecheck          | `npm run typecheck`        | `tsc --noEmit`                                 |
| testy              | `npm run test`             | vitest run (jsdom), ~45 s na calosci           |
| jeden plik testowy | `npx vitest run <sciezka>` |                                                |
| formatowanie       | `npm run format:check`     | prettier; CI to sprawdza                       |

Backend (FastAPI) startuje osobno z `backend/` (`uvicorn main:app --reload`,
szczegoly w `komendy.txt`). Jest tez `docker-compose.yml` dla calosci.

Przed zgloszeniem "dziala": `typecheck` + `lint` + `test` maja przejsc na twoich oczach.

## Uklad `src/`

Dwie warstwy (pelny opis: `docs/architecture/frontend-structure.md`):

- `src/app/` - WYLACZNIE routing Next.js (App Router, route groups `(public)`,
  `(auth)`, `(dashboard)`, `(whiteboard)`, `(info)`, `api/`). Strony skladaja
  komponenty z `src/_new`. Wyjatek: `src/app/context/*` to legacy do migracji
  (BoardRealtimeContext, VoiceChatContext) - patrz `docs/migration-status.md`
  ZANIM tam cos zmienisz.
- `src/_new/` - cala logika: `features/<nazwa>/` (auth, board, demo,
  notifications, whiteboard, workspace), `lib/` (api client, auth/tokenService,
  errors), `shared/` (hooki, typy, UI reuzywalne).

Aliasy z `tsconfig.json`: `@/*` -> `src/*`, `@new/*` -> `src/_new/*`.
Testy leza obok kodu (`*.test.ts[x]`), setup w `src/test/setup.ts`.

Chcesz zmienic JAK WYGLADA / ROUTUJE sie strona -> `src/app`.
Chcesz zmienic JAK COS DZIALA -> `src/_new/features/<nazwa>`.

## Git - jak commitowac

1. **Commituj po jawnych sciezkach**: `git add src/a.ts src/b.ts`, potem commit.
   **Nigdy `git add -A` ani `git add .`** - `next dev` nadpisuje sledzony
   `next-env.d.ts` (ten diff NIE ma trafiac do commitow), a w drzewie potrafia
   lezec nieprzewidziane pliki robocze.
2. Komunikaty commitow: conventional commits (`feat(demo): ...`,
   `fix(whiteboard): ...`), po polsku, temat zaczyna sie MALA litera
   (commitlint odrzuca np. `docs: CLAUDE.md ...`). Pilnuje tego hook commit-msg.
3. Hook pre-commit uruchamia `lint-staged` (prettier na staged plikach).
   Nie omijaj go `--no-verify`, chyba ze naprawde nie da sie inaczej - wtedy
   puszcz prettier recznie i napisz o tym w raporcie.
4. **Po KAZDYM commicie odpal `git show --stat HEAD`** - bez zadnych flag.
   Jesli liczba zmienionych linii jest absurdalnie duza wzgledem tego, co
   edytowales (np. caly plik jako +/-), to znaczy ze cos poszlo nie tak
   z koncami linii (repo ma `core.autocrlf=true`, prettier pisze LF).
   ZATRZYMAJ SIE i powiedz Patrykowi, nie commituj dalej.
5. Pracujesz na osobnym branchu. Zero `git push`, zero merge do `main`.
