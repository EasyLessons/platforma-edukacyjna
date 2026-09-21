# EasyLessons

A real-time collaborative teaching platform built for online tutoring - a shared interactive whiteboard, instant math/physics formula search, and an AI assistant, all in one place instead of juggling separate tools for drawing, chat, and reference material.

> **Status:** actively in development, not a finished/polished product - some rough edges and incomplete flows are expected.

**Live: [easylesson.app](https://www.easylesson.app/)**

![dashboard](docs/screenshots/dashboard.png)

![whiteboard](docs/screenshots/whiteboard.png)

## Features

- **Shared whiteboard** - real-time collaborative drawing/writing with a full toolset (11 tools), undo/redo via a command-pattern history stack; sync is being migrated from Supabase Broadcast to a Yjs CRDT document served by a Hocuspocus service (`whiteboard-sync/`, behind `NEXT_PUBLIC_WHITEBOARD_YJS`)
- **SmartSearch** - quick lookup and insertion of math/physics formulas, rendered with KaTeX
- **AI Assistant** - chat assistant that can also accept images, with response caching and rate limiting
- **Workspaces & boards** - organize lessons into workspaces, invite collaborators (named invites or share links) with role-based permissions (owner/editor)
- **Demo board** - try the whiteboard without an account
- **Real-time notifications** - invites, workspace membership changes, unread badges
- **Voice chat** - WebRTC-based voice calls within a board
- **Authentication** - email/password with verification codes, Google OAuth, cookie-based sessions with refresh-token rotation

## Tech stack

**Frontend:** Next.js (App Router), React 19, TypeScript, Tailwind CSS, TanStack Query, Zustand, Yjs, KaTeX, Vitest
**Backend:** Python, FastAPI, SQLAlchemy, Alembic, PostgreSQL (Neon, serverless), Redis
**Realtime:** Supabase Realtime (presence, notifications, voice signalling), Hocuspocus (`whiteboard-sync`, Yjs documents), WebRTC (Xirsys TURN)
**Infra/Auth:** Docker, JWT, Google OAuth, Supabase Storage (board images), Resend (email), Gemini API (AI assistant)
**Tooling:** ESLint, Prettier, Husky, commitlint, dependency-cruiser

Full architecture docs: start at [docs/README.md](docs/README.md).

## Running it locally

### Docker (recommended for demos / clean-machine checks)

```bash
git clone https://github.com/EasyLessons/platforma-edukacyjna.git
cd platforma-edukacyjna

cp .env.example .env.local
cp backend/.env.example backend/.env
# fill in the values in both files

docker compose up --build      # first run (builds images, ~2-3 min)
docker compose up              # subsequent runs
docker compose up -d           # detached; logs: docker compose logs -f [frontend|backend|whiteboard-sync]
docker compose down            # stop (-v to also drop volumes)
docker compose build backend   # rebuild one service after changing requirements.txt / package.json
```

Source folders are mounted as volumes, so code changes hot-reload without a rebuild - only dependency changes need `build`.

Services: frontend http://localhost:3000, backend API http://localhost:8000 (Swagger: http://localhost:8000/docs), whiteboard-sync ws://localhost:1234, Redis 6379.

### Manual setup (day-to-day development)

Requires Node.js 20+, Python 3.12+. The database runs on Neon (serverless Postgres) - no local Postgres install needed, just a `DATABASE_URL` in `backend/.env`.

```bash
# Backend (once)
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1        # Windows; on macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head

# Backend (every time, from backend/ with venv active)
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Frontend (new terminal, from project root)
npm install
npm run dev

# Whiteboard sync service (only when NEXT_PUBLIC_WHITEBOARD_YJS=true)
cd whiteboard-sync && npm install && npm run dev
```

### Checks before pushing (same as CI)

```bash
# frontend (project root)
npm run typecheck
npm run lint
npm run test
npm run format:check

# backend (backend/, venv active)
ruff check .
pytest tests/ -v

# database migrations
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

Branching, PR flow and what CI enforces: [docs/architecture/ci-cd.md](docs/architecture/ci-cd.md).
