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

-- ---- RAG: cross-session memory (pgvector) ---------------------------------
-- Gemini text-embedding-004 = 768 dims.
create extension if not exists vector;

create table if not exists public.message_embeddings (
    message_id uuid primary key
        references public.messages (id) on delete cascade,
    user_id    uuid not null references auth.users (id) on delete cascade,
    session_id uuid not null references public.sessions (id) on delete cascade,
    role       text not null,
    content    text not null,
    embedding  vector(768) not null,
    created_at timestamptz not null default now()
);

create index if not exists message_embeddings_user_idx
    on public.message_embeddings (user_id);
create index if not exists message_embeddings_vec_idx
    on public.message_embeddings
    using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table public.message_embeddings enable row level security;
drop policy if exists "own embeddings" on public.message_embeddings;
create policy "own embeddings" on public.message_embeddings
    for all using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Cosine similarity search over the user's prior messages.
create or replace function public.match_user_messages(
    query_embedding vector(768),
    p_user_id uuid,
    p_exclude_session uuid,
    match_count int
)
returns table (
    role text, content text, similarity float, created_at timestamptz
)
language sql stable
as $$
    select e.role, e.content,
           1 - (e.embedding <=> query_embedding) as similarity,
           e.created_at
    from public.message_embeddings e
    where e.user_id = p_user_id
      and (p_exclude_session is null or e.session_id <> p_exclude_session)
    order by e.embedding <=> query_embedding
    limit match_count;
$$;

-- ---- AI News -------------------------------------------------------------
create table if not exists public.news_articles (
    id           uuid primary key default gen_random_uuid(),
    title        text not null,
    url          text not null unique,
    source       text,
    summary      text,
    content      text,
    published_at timestamptz,
    created_at   timestamptz not null default now()
);
alter table public.news_articles enable row level security;
drop policy if exists "news read" on public.news_articles;
create policy "news read" on public.news_articles
    for select to authenticated using (true);

-- Sessions can be anchored to a news article (chat grounded in it).
alter table public.sessions
    add column if not exists news_article_id uuid
        references public.news_articles (id) on delete set null;
