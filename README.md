# EasyLessons

A real-time collaborative teaching platform built for online tutoring - a shared interactive whiteboard, instant math/physics formula search, and an AI assistant, all in one place instead of juggling separate tools for drawing, chat, and reference material.

> **Status:** actively in development, not a finished/polished product - some rough edges and incomplete flows are expected.

**Live: [easylesson.app](https://www.easylesson.app/)**

![dashboard](docs/screenshots/dashboard.png)

![whiteboard](docs/screenshots/whiteboard.png)

## Features

- **Shared whiteboard** - real-time collaborative drawing/writing with a full toolset (11 tools), undo/redo via a command-pattern history stack
- **SmartSearch** - quick lookup and insertion of math/physics formulas, rendered with KaTeX
- **AI Assistant** - chat assistant that can also accept images, with response caching and rate limiting
- **Workspaces & boards** - organize lessons into workspaces, invite collaborators with role-based permissions (owner/editor)
- **Real-time notifications** - invites, workspace membership changes, unread badges
- **Voice chat** - WebRTC-based voice calls within a board
- **Authentication** - email/password with verification codes, Google OAuth, cookie-based sessions with refresh-token rotation

## Tech stack

**Frontend:** Next.js, React, TypeScript, Tailwind CSS, Zustand, KaTeX, Vitest
**Backend:** Python, FastAPI, SQLAlchemy, Alembic, PostgreSQL (Neon, serverless)
**Infra/Auth:** Docker, JWT, Google OAuth, Supabase, WebRTC (Xirsys), Resend (email), Gemini API (AI assistant)
**Tooling:** ESLint, Prettier, Husky, commitlint

## Running it locally

### Docker (recommended)

```bash
git clone https://github.com/Berkel1611/easylesson.git
cd easylesson

cp .env.example .env.local
cp backend/.env.example backend/.env
# fill in the values in both files

docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs (Swagger): http://localhost:8000/docs

### Manual setup

Requires Node.js 20+, Python 3.12+, and npm/pip. The database runs on Neon (serverless Postgres) - no local Postgres install needed, just a `DATABASE_URL` in `backend/.env`.

```bash
# Backend
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Frontend (new terminal, from project root)
npm install
npm run dev
```