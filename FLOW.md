# Project Flow — Context-Aware Chatbot (Axis)

Detailed flow of the system. Diagrams mirror the actual code
(`backend/app/*`, `frontend/src/*`).

---

## 1. System architecture

```mermaid
flowchart TB
    subgraph Browser["Browser — React + Vite"]
        UI["App.jsx<br/>Login · Sidebar · ChatMain · Composer"]
        AC["AuthContext<br/>(supabase-js, anon key)"]
        SP["useSpeech<br/>STT (mic) · TTS (read aloud)"]
        APIc["api.js<br/>fetch + Bearer JWT"]
    end

    subgraph SB["Supabase (project jwkaeamalpewamuqiiai)"]
        SBAuth["Auth<br/>email/pw, JWT issue"]
        PG[("Postgres")]
        TBL["public.sessions / public.messages<br/>RLS: auth.uid() = user_id"]
        CKPT["LangGraph checkpoint tables<br/>(AsyncPostgresSaver)"]
    end

    subgraph API["FastAPI backend (uvicorn :8000)"]
        MW["CORS + global error handler"]
        AUTHDEP["auth.py<br/>verify JWT to user_id"]
        RT["routes.py<br/>/sessions /chat /health"]
        DB["db.py<br/>service-role client"]
        RTme["runtime.py<br/>lazy graph init"]
        GR["graph.py<br/>StateGraph + Gemini node"]
    end

    GEM["Google Gemini<br/>gemini-2.5-flash"]

    AC -->|signup/login| SBAuth
    SBAuth -->|JWT| AC
    UI --> APIc
    SP -. mic/speaker .- UI
    APIc -->|Authorization: Bearer JWT| MW
    MW --> AUTHDEP
    AUTHDEP -->|auth.get_user jwt| SBAuth
    AUTHDEP --> RT
    RT --> DB
    DB -->|REST, service key| TBL
    RT --> RTme --> GR
    GR -->|thread_id = session_id| CKPT
    GR -->|prompt + history| GEM
    GEM -->|reply| GR
    TBL --- PG
    CKPT --- PG
```

---

## 2. Login + session bootstrap

```mermaid
flowchart TD
    A[Open app] --> B{AuthContext session?}
    B -- none --> C[Login screen]
    C --> D[signUp / signIn via supabase-js]
    D --> E{email confirm on?}
    E -- yes --> F[Confirm via email link] --> C
    E -- no --> G[JWT in session]
    B -- exists --> G
    G --> H[GET /api/sessions with Bearer JWT]
    H --> I{rows?}
    I -- yes --> J[pick remembered/last to activeId]
    I -- none --> K[POST /api/sessions new]
    J --> L[ChatMain renders]
    K --> L
    H -- error --> M[init-error panel + Retry]
```

---

## 3. Chat message round-trip (core)

```mermaid
sequenceDiagram
    actor U as User
    participant FE as React (useChat)
    participant API as FastAPI /api/chat
    participant AU as Supabase Auth
    participant DB as Supabase DB (REST)
    participant LG as LangGraph
    participant CK as PostgresSaver
    participant GM as Gemini

    U->>FE: type / dictate message, Enter
    FE->>FE: optimistic user bubble
    FE->>API: POST /chat {session_id, message} + JWT
    API->>AU: verify JWT
    AU-->>API: user_id
    API->>DB: get_session(session_id, user_id) ownership
    DB-->>API: ok / 404
    API->>DB: insert user message (mirror)
    API->>LG: ainvoke({messages:[Human]}, thread_id=session_id)
    LG->>CK: load prior state for thread
    CK-->>LG: past messages
    LG->>GM: system + history + new msg (cap HISTORY_LIMIT)
    GM-->>LG: reply
    LG->>CK: persist new state
    LG-->>API: result.messages[-1]
    API->>DB: insert assistant message (mirror)
    API-->>FE: {reply}
    FE-->>U: bot bubble (TTS optional)
```

---

## 4. LangGraph internal

```mermaid
flowchart LR
    S([START]) --> M["model node<br/>SystemPrompt + last N msgs to Gemini"]
    M --> E([END])
    M -. read/write state .-> C[("AsyncPostgresSaver<br/>thread_id = session_id")]
```

---

## Design notes

- **Dual storage:** `public.messages` is the RLS-owned source of truth for the
  UI (sidebar list, rendered history). The LangGraph `AsyncPostgresSaver`
  checkpointer holds the model's working memory. Both live in the same
  Supabase Postgres but serve different purposes.
- **Context-aware:** the checkpointer auto-loads thread state keyed by
  `thread_id == session_id`, so Gemini always answers with the full
  conversation. History is capped to the last `HISTORY_LIMIT` turns for
  cost/latency.
- **Session isolation:** each chat is a separate `session_id` = separate
  LangGraph thread. No cross-chat memory by design (matches the requirement
  "stores conversation per user session").
- **Security:** the browser only ever holds the public anon key. The backend
  verifies the Supabase JWT on every request, scopes all queries by
  `user_id`, and RLS (`auth.uid() = user_id`) is enabled as defense-in-depth.
- **Voice:** STT uses the browser `SpeechRecognition` API (Chromium only —
  Brave blocks it). TTS uses `speechSynthesis` (works everywhere). Both are
  client-side; no backend involvement.
- **Serverless-safe:** the LangGraph graph + DB connection initialize lazily
  on first request (`runtime.py`) and are cached per process, so Vercel
  serverless cold starts work without relying on ASGI lifespan.
