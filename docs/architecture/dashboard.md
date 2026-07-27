# Architektura dashboardu

Panel użytkownika po zalogowaniu: `src/app/(dashboard)/`. Odpowiada za zarządzanie workspace'ami, boardami, zaproszeniami i profilem.

## Funkcje

- **Workspace'y** — kontenery na boardy. User może mieć wiele workspace'ów, każdy z rolą (`owner`/`editor` — patrz `WorkspaceMember` w `backend-structure.md`). Jeden workspace jest "aktywny" (`active_workspace_id` na `User`) — to ten, którego zawartość widać w dashboardzie po wejściu.
- **Boardy** — tablice wewnątrz workspace'u. Widoki: lista ostatnich (`RecentsView`), lista wg sekcji/szablonów (`TemplateSection`), pełna lista z sortowaniem/filtrowaniem (`BoardsSection`).
- **Zaproszenia** — właściciel/edytor workspace'u zaprasza innego usera (po emailu/username, wyszukiwanie przez `/search-users`). Zaproszony dostaje powiadomienie (patrz `pipelines.md` — przepływ powiadomień) i może zaakceptować przez link `/invite/[token]`.
- **Ulubione** — zarówno workspace, jak i pojedynczy board można oznaczyć jako ulubiony (`is_favourite` w `WorkspaceMember` i `BoardUsers` — dwa niezależne pola, bo to dwa niezależne poziomy ulubionych).
- **Profil (`account/`)** — edycja danych podstawowych, avatar.

## Struktura komponentów

```
src/app/(dashboard)/
├── dashboard/
│   ├── page.tsx
│   ├── Header/DashboardHeader.tsx
│   └── Components/
│       ├── BoardsSection.tsx       ← import z src/_new/features/board (lista, tworzenie, edycja, usuwanie)
│       ├── RecentsView.tsx         ← ostatnio otwierane boardy
│       ├── TemplateSection.tsx     ← szablony boardów
│       ├── workspace-sidebar.tsx   ← lista workspace'ów usera
│       └── workspace-top-nav.tsx   ← przełącznik aktywnego workspace'u
├── account/
│   ├── page.tsx
│   └── components/ProfileSection/BasicInfo.tsx
└── invite/[token]/page.tsx          ← akceptacja zaproszenia
```

Logika (hooki, typy, wywołania API) żyje w `src/_new/features/board`, `src/_new/features/workspace`, `src/_new/features/notifications` — komponenty w `src/app/(dashboard)` je tylko konsumują. Jeśli zmieniasz **co dashboard robi** (np. nowy filtr boardów, nowa reguła uprawnień), zmiana wchodzi w `src/_new/features/*`, nie w `src/app/(dashboard)`.

## Backend

`backend/api/v1/workspaces/` — CRUD workspace'u + `GET /init` (jedno zapytanie zwracające wszystkie dane startowe dashboardu — workspace'y, aktywny workspace, boardy — żeby uniknąć wielu osobnych requestów przy pierwszym renderze). Podmoduły: `invites_router.py`/`invites_service.py` (zaproszenia), `members_router.py`/`members_service.py` (zarządzanie członkami workspace'u).
`backend/api/v1/boards/` — CRUD boardu, dołączanie, ulubione, ustawienia, lista członków boardu.
`backend/dashboard/` — agregacja danych pomocnicza dla widoków dashboardu (jeśli logika przekracza to co naturalnie mieści się w `boards`/`workspaces`).

## Uprawnienia

Dwa niezależne poziomy dostępu: **workspace** (`WorkspaceMember.role`: `owner` może zapraszać/usuwać workspace, `editor` może tworzyć/edytować boardy) i **board** (`BoardUsers` — kto konkretnie ma dostęp do danej tablicy). To rozdzielenie istnieje po to, żeby w przyszłości można było udostępnić pojedynczy board bez wpuszczania kogoś do całego workspace'u — funkcja jeszcze nie zbudowana w UI, ale model danych już to wspiera.
