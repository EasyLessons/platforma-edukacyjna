# Architektura dashboardu

Panel użytkownika po zalogowaniu: `src/app/(dashboard)/`. Odpowiada za zarządzanie workspace'ami, boardami, zaproszeniami i profilem.

## Funkcje

- **Workspace'y** — kontenery na boardy. User może mieć wiele workspace'ów, każdy z rolą (`owner`/`editor` — patrz `WorkspaceMember` w `backend-structure.md`). Jeden workspace jest "aktywny" — to ten, którego zawartość widać w dashboardzie po wejściu. Wybór jest czysto klienckim stanem (URL param `?workspace=`, z fallbackiem do `localStorage`, dalej do pierwszego ulubionego/pierwszego z listy) — backend niczego tu nie persystuje.
- **Boardy** — tablice wewnątrz workspace'u. Widoki: lista ostatnich (`RecentsView`), lista wg sekcji/szablonów (`TemplateSection`), pełna lista z sortowaniem/filtrowaniem (`BoardsSection`).
- **Zaproszenia** — właściciel/edytor workspace'u zaprasza innego usera (po emailu/username, wyszukiwanie przez `GET /{workspace_id}/invite/users` — zwraca kandydatów razem z informacją, czy już mają aktywne zaproszenie). Zaproszony dostaje powiadomienie (patrz `pipelines.md` — przepływ powiadomień) i może zaakceptować przez link `/invite/[token]`. Druga droga: **link udostępniania** (`workspaces/share_links/`, tabela `WorkspaceShareLink`) — właściciel generuje/odświeża token, każdy z linkiem dołącza przez `/join/[token]` z rolą zapisaną w linku.
- **Ulubione** — zarówno workspace, jak i pojedynczy board można oznaczyć jako ulubiony (`is_favourite` w `WorkspaceMember` i `BoardUsers` — dwa niezależne pola, bo to dwa niezależne poziomy ulubionych).
- **Profil (`account/`)** — edycja danych podstawowych, avatar.

## Struktura komponentów

```
src/app/(dashboard)/
├── layout.tsx
├── dashboard/
│   ├── page.tsx
│   ├── Header/
│   │   ├── DashboardHeader.tsx        ← nagłówek (powiadomienia, menu usera, mobile hamburger)
│   │   └── popups/                    (GiftPopup, UserMenuPopup)
│   └── Components/
│       ├── BoardsSection.tsx          ← import z src/_new/features/board (lista, tworzenie, edycja, usuwanie)
│       ├── RecentsView.tsx            ← ostatnio otwierane boardy
│       ├── TemplateSection.tsx        ← szablony boardów
│       ├── WelcomeSection.tsx
│       ├── workspace-sidebar.tsx      ← lista workspace'ów usera (na telefonie wysuwana)
│       ├── workspace-top-nav.tsx      ← przełącznik aktywnego workspace'u
│       ├── open-workspaces-button.tsx ← przycisk otwierający sidebar na telefonie
│       ├── DashboardButton.tsx        ← przycisk używany też przez modale w src/_new (do przeniesienia do shared/ui)
│       └── _tests/
├── account/
│   ├── page.tsx
│   ├── types.ts
│   └── components/ (Sidebar, ProfileSection/BasicInfo — realne dane;
│                    AddressBook, PaymentMethods, SecurityCenter — makiety bez backendu)
├── invite/[token]/page.tsx            ← akceptacja zaproszenia imiennego
└── join/[token]/page.tsx              ← dołączenie przez link udostępniania
```

Logika (hooki, typy, wywołania API) żyje w `src/_new/features/board`, `src/_new/features/workspace`, `src/_new/features/notifications` — komponenty w `src/app/(dashboard)` je tylko konsumują. Jeśli zmieniasz **co dashboard robi** (np. nowy filtr boardów, nowa reguła uprawnień), zmiana wchodzi w `src/_new/features/*`, nie w `src/app/(dashboard)`.

## Backend

`backend/api/v1/workspaces/` — CRUD workspace'u. `GET /workspaces/{id}` zwraca workspace razem z jego boardami w jednym requeście (komponuje `BoardService.list_boards` z poziomu `WorkspaceService`) — klient (znający aktywny workspace z URL/`localStorage`) woła ten jeden endpoint zamiast osobnego bootstrap-requestu. Podmoduły: `invites/router.py`/`invites/service.py` (zaproszenia), `members/router.py`/`members/service.py` (zarządzanie członkami workspace'u).
`backend/api/v1/boards/` — CRUD boardu, dołączanie, ulubione, ustawienia, lista członków boardu.
Nie ma osobnego modułu `backend/dashboard/` — dashboard składa się wyłącznie z `workspaces` (+ `members`, `invites`, `share_links`) i `boards`.

## Uprawnienia

Dwa niezależne poziomy dostępu: **workspace** (`WorkspaceMember.role`: `owner` może zapraszać/usuwać workspace, `editor` może tworzyć/edytować boardy) i **board** (`BoardUsers` — kto konkretnie ma dostęp do danej tablicy). To rozdzielenie istnieje po to, żeby w przyszłości można było udostępnić pojedynczy board bez wpuszczania kogoś do całego workspace'u — funkcja jeszcze nie zbudowana w UI, ale model danych już to wspiera.
