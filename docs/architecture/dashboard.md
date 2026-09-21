# Architektura dashboardu

Panel użytkownika po zalogowaniu: `src/app/(dashboard)/`. Odpowiada za zarządzanie workspace'ami, boardami, zaproszeniami i profilem.

## Funkcje

- **Workspace'y** — kontenery na boardy. User może mieć wiele workspace'ów, każdy z rolą (`owner`/`editor` — patrz `WorkspaceMember` w `backend-structure.md`). Jeden workspace jest "aktywny" — to ten, którego zawartość widać w dashboardzie po wejściu. Wybór jest czysto klienckim stanem (URL param `?workspace=`, z fallbackiem do `localStorage`, dalej do pierwszego ulubionego/pierwszego z listy) — backend niczego tu nie persystuje.
- **Boardy** — tablice wewnątrz workspace'u. Widoki: lista ostatnich (`RecentsView`), lista wg sekcji/szablonów (`TemplateSection`), pełna lista z sortowaniem/filtrowaniem (`BoardsSection`).
- **Zaproszenia** — właściciel/edytor workspace'u zaprasza innego usera (po emailu/username, wyszukiwanie przez `GET /{workspace_id}/invite/users` — zwraca kandydatów razem z informacją, czy już mają aktywne zaproszenie). Zaproszony dostaje powiadomienie (patrz `pipelines.md` — przepływ powiadomień) i może zaakceptować przez link `/invite/[token]`. Druga droga: **link udostępniania** (`workspaces/share_links/`, tabela `WorkspaceShareLink`) — właściciel generuje/odświeża token, każdy z linkiem dołącza przez `/join/[token]` z rolą zapisaną w linku.
- **Ulubione** — zarówno workspace, jak i pojedynczy board można oznaczyć jako ulubiony (`is_favourite` w `WorkspaceMember` i `BoardUsers` — dwa niezależne pola, bo to dwa niezależne poziomy ulubionych).
- **Profil (`account/`)** — edycja danych podstawowych, avatar.

## Struktura komponentów

Strony w `src/app/(dashboard)` to cienki routing; komponenty żyją w feature'ach i wchodzą przez barrele `index.ts`:

```
src/app/(dashboard)/
├── layout.tsx                        ← DashboardHeader z @/_new/features/dashboard + dashboard-theme.css
├── dashboard/page.tsx                ← składa WorkspaceSidebar, WorkspaceTopNav, BoardsSection, TemplatesSection, RecentsView
├── dashboard/dashboard-theme.css     ← klasy dashboard-* (także dla shared/ui/dashboard-button)
├── account/page.tsx                  ← składa Sidebar, ProfileSection, AddressBook, PaymentMethods, SecurityCenter
├── invite/[token]/page.tsx           ← akceptacja zaproszenia imiennego
└── join/[token]/page.tsx             ← dołączenie przez link udostępniania

src/_new/features/dashboard/
├── index.ts
└── components/
    ├── BoardsSection.tsx             ← lista/tworzenie/edycja/usuwanie boardów (features/board)
    ├── RecentsView.tsx               ← ostatnio otwierane boardy
    ├── TemplateSection.tsx           ← szablony boardów
    ├── workspace-sidebar.tsx         ← lista workspace'ów (na telefonie wysuwana)
    ├── workspace-top-nav.tsx         ← przełącznik aktywnego workspace'u
    ├── open-workspaces-button.tsx
    ├── header/DashboardHeader.tsx    ← powiadomienia, menu usera, mobile hamburger; popups/
    └── _tests/

src/_new/features/account/
├── index.ts, types.ts (ActiveSection)
└── components/
    ├── Sidebar.tsx, ProfileSection/  ← realne dane (/api/v1/auth/me)
    └── _mock/                        ← AddressBook, PaymentMethods, SecurityCenter: makiety bez backendu (known-issues #5)
```

Współdzielony przycisk panelu: `src/_new/shared/ui/dashboard-button.tsx`.

Logika (hooki, typy, wywołania API) żyje w `src/_new/features/board`, `src/_new/features/workspace`, `src/_new/features/notifications` — `features/dashboard` i `features/account` to układ i kompozycja. Jeśli zmieniasz **co dashboard robi** (np. nowy filtr boardów, nowa reguła uprawnień), zmiana wchodzi w `features/board`/`workspace`, nie w komponenty panelu ani w `src/app/(dashboard)`.

## Backend

`backend/api/v1/workspaces/` — CRUD workspace'u. `GET /workspaces/{id}` zwraca workspace razem z jego boardami w jednym requeście (komponuje `BoardService.list_boards` z poziomu `WorkspaceService`) — klient (znający aktywny workspace z URL/`localStorage`) woła ten jeden endpoint zamiast osobnego bootstrap-requestu. Podmoduły: `invites/router.py`/`invites/service.py` (zaproszenia), `members/router.py`/`members/service.py` (zarządzanie członkami workspace'u).
`backend/api/v1/boards/` — CRUD boardu, dołączanie, ulubione, ustawienia, lista członków boardu.
Nie ma osobnego modułu `backend/dashboard/` — dashboard składa się wyłącznie z `workspaces` (+ `members`, `invites`, `share_links`) i `boards`.

## Uprawnienia

Dwa niezależne poziomy dostępu: **workspace** (`WorkspaceMember.role`: `owner` może zapraszać/usuwać workspace, `editor` może tworzyć/edytować boardy) i **board** (`BoardUsers` — kto konkretnie ma dostęp do danej tablicy). To rozdzielenie istnieje po to, żeby w przyszłości można było udostępnić pojedynczy board bez wpuszczania kogoś do całego workspace'u — funkcja jeszcze nie zbudowana w UI, ale model danych już to wspiera.
