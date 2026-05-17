# Context-Aware Chatbot

A multi-turn chatbot that **remembers previous messages and answers
contextually**, keeps **per-session history**, and **stores every conversation
per authenticated user**.

Built for the Xccelera AI assignment.

---

## What it does

- Sign up / sign in (Supabase Auth — real accounts).
- Chat with an LLM that remembers everything said earlier in the session
  ("My name is Saketh" → later "What's my name?" → *"Saketh"*).
- Multiple conversations per user; switch between them in a sidebar.
- History survives page refresh and re-login (persisted in Postgres).
- Conversations are isolated per user and enforced by Row Level Security.

---

## Architecture

```
React (Vite) ──HTTPS──▶ FastAPI ──▶ LangGraph StateGraph
   │  Supabase JS              │         │
   │  (auth, anon key)         │         ├─▶ Gemini  (langchain-google-genai)
   │                           │         └─▶ AsyncPostgresSaver  ─┐
   └─ Bearer JWT ──────────────┘                                  │ thread_id
                               │                                  │ = session_id
                               ├─▶ Supabase Auth  (verify JWT)     │
                               └─▶ Supabase Postgres ◀─────────────┘
                                     sessions / messages (RLS)
```

### How context-awareness works

The core is a **LangGraph `StateGraph`** over `MessagesState` with a single
Gemini node (`backend/app/graph.py`). Memory is **not** re-implemented by
hand — it is provided by LangGraph's **`AsyncPostgresSaver` checkpointer**,
keyed by `thread_id == session_id`. On every `/api/chat` call:

1. The checkpointer **loads the prior graph state** for that session's thread.
2. The new user message is appended; Gemini is called with the full history
   (capped to the last `HISTORY_LIMIT` turns for cost/latency).
3. The checkpointer **persists the new state** automatically.

This is what makes answers context-aware across turns.

### Dual storage (by design)

| Store | Purpose |
|-------|---------|
| LangGraph `AsyncPostgresSaver` (its own checkpoint tables) | conversation **memory** — the model's working context |
| `sessions` / `messages` tables (RLS on `user_id`) | app **source of truth** — auth ownership, sidebar listing, UI history |

Each turn is mirrored into `messages` so the UI/history is owned by RLS and
tied to a user, while LangGraph independently manages model memory.

### Security

- Frontend authenticates with the **public anon key**; never sees service keys.
- Backend verifies the Supabase **JWT** on every request and resolves `user_id`.
- Every DB query is explicitly scoped by `user_id`; session ownership is
  checked before chat.
- **RLS** is enabled (`auth.uid() = user_id`) as defense-in-depth.

---

## Tech stack

FastAPI · LangGraph · LangChain (`langchain-google-genai`) · Google Gemini ·
Supabase (Auth + Postgres) · React + Vite + Tailwind · Vercel.

---

## Prerequisites

1. **Gemini API key** — https://aistudio.google.com/app/apikey
2. **Supabase project** — https://supabase.com (free tier)
3. Python 3.12, Node 18+.

---

## Setup

### 1. Database

Supabase Dashboard → **SQL Editor** → run `supabase/schema.sql`.
Creates `sessions` + `messages` with RLS. (LangGraph creates its own
checkpoint tables automatically on first run.)

### 2. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # or: conda activate chatbot
pip install -r requirements.txt
cp .env.example .env        # fill in the values below
uvicorn app.main:app --reload
```

`backend/.env`:

| Var | Where to find it |
|-----|------------------|
| `GEMINI_API_KEY` | Google AI Studio |
| `GEMINI_MODEL` | default `gemini-2.0-flash` |
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_KEY` | same page → `service_role` key (**server only**) |
| `SUPABASE_DB_URL` | Project Settings → Database → Connection string (URI) |
| `CORS_ORIGINS` | frontend URL, e.g. `http://localhost:5173` |

> **Important:** `SUPABASE_DB_URL` must be the **direct / session pooler**
> connection (port `5432`). The **transaction pooler** (port `6543`) does not
> support the prepared statements LangGraph's Postgres saver uses.

Swagger UI: `http://localhost:8000/docs` · health: `/api/health`.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env        # set VITE_API_BASE_URL + Supabase URL + anon key
npm run dev
```

Open `http://localhost:5173`.

---

## Deployment (Vercel — free)

Two Vercel projects from this repo:

**Frontend** — root directory `frontend/`. Vite auto-detected (`vercel.json`
included). Set env: `VITE_API_BASE_URL` (deployed backend URL),
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

**Backend** — root directory `backend/`. The `@vercel/python` runtime serves
the ASGI app via `api/index.py` (`vercel.json` rewrites all routes). Set the
same env vars as `backend/.env`.

Notes / caveats for serverless:

- Lifespan events are unreliable on serverless, so the LangGraph graph + DB
  connection are **lazily initialized on first request** and cached per
  process (`app/runtime.py`). Local/long-running servers use the lifespan.
- Use the **session pooler** DB URL (not transaction pooler) — see above.
- Gemini-flash responses are ~1–3s, well within Vercel's function limit.
- Alternative free backend host with no lifespan caveat: Render / Fly.io.

After deploy, add the frontend domain to `CORS_ORIGINS` on the backend.

---

## API

All `/api/*` routes except `/api/health` require
`Authorization: Bearer <supabase_jwt>`.

| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET  | `/api/health` | — | `{status}` |
| POST | `/api/sessions` | `{title?}` | created session |
| GET  | `/api/sessions` | — | user's sessions |
| GET  | `/api/sessions/{id}/messages` | — | ordered history |
| POST | `/api/chat` | `{session_id, message}` | `{session_id, reply}` |

---

## Verifying the requirements

| Requirement | How it's met | How to check |
|-------------|--------------|--------------|
| User sends messages | `/api/chat`, chat UI | send a message |
| Keeps session history | LangGraph checkpointer + `messages` table | refresh page → history reloads |
| Context-aware answers | Gemini called with full thread state | "My name is X" then "What's my name?" |
| Per user session storage | `sessions.user_id` + RLS, thread per session | "New chat" → isolated; switch sessions |

---

## Project structure

```
backend/
  app/  config, schemas, db, auth, graph (LangGraph), runtime, routes, main
  api/index.py        # Vercel ASGI entry
  vercel.json
supabase/schema.sql   # tables + RLS
frontend/src/
  contexts/AuthContext.jsx   lib/supabase.js   api.js   hooks/useChat.js
  components/ Login · SessionList · ChatWindow · MessageInput
  App.jsx
```
