-- Context-Aware Chatbot — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
--
-- These tables are the app's RLS-owned source of truth for the UI (session
-- list + rendered history). LangGraph's AsyncPostgresSaver maintains its own
-- checkpoint tables separately for conversation memory.

create extension if not exists pgcrypto;

-- ---- sessions -------------------------------------------------------------
create table if not exists public.sessions (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references auth.users (id) on delete cascade,
    title      text,
    created_at timestamptz not null default now()
);

create index if not exists sessions_user_created_idx
    on public.sessions (user_id, created_at desc);

-- ---- messages -------------------------------------------------------------
create table if not exists public.messages (
    id         uuid primary key default gen_random_uuid(),
    session_id uuid not null references public.sessions (id) on delete cascade,
    role       text not null check (role in ('user', 'assistant')),
    content    text not null,
    created_at timestamptz not null default now()
);

create index if not exists messages_session_created_idx
    on public.messages (session_id, created_at);

-- ---- Row Level Security ---------------------------------------------------
-- The backend uses the service-role key and bypasses RLS, but every query is
-- still explicitly scoped by the verified user_id. RLS below is enforced as
-- defense-in-depth so a leaked anon key cannot read other users' data.

alter table public.sessions enable row level security;
alter table public.messages enable row level security;

drop policy if exists "own sessions" on public.sessions;
create policy "own sessions" on public.sessions
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "own messages" on public.messages;
create policy "own messages" on public.messages
    for all
    using (
        exists (
            select 1 from public.sessions s
            where s.id = messages.session_id and s.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from public.sessions s
            where s.id = messages.session_id and s.user_id = auth.uid()
        )
    );
