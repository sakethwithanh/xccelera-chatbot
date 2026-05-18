"""Cross-session memory (RAG).

Each turn is embedded with Gemini and stored in Supabase pgvector. Before
answering, the user's prior messages across *all* their sessions are searched
by cosine similarity and the top matches are injected as extra context.
"""

import asyncio
from functools import lru_cache

from langchain_google_genai import GoogleGenerativeAIEmbeddings

from .config import get_settings
from .db import _client

EMBED_MODEL = "models/gemini-embedding-001"
EMBED_DIM = 768  # must match message_embeddings.embedding vector(768)
TOP_K = 6
MIN_SIMILARITY = 0.6


@lru_cache
def _embedders() -> tuple:
    return tuple(
        GoogleGenerativeAIEmbeddings(
            model=EMBED_MODEL,
            google_api_key=k,
            output_dimensionality=EMBED_DIM,
        )
        for k in get_settings().gemini_keys
    )


async def embed(text: str) -> list[float]:
    embedders = _embedders()
    last_exc = None
    for i, e in enumerate(embedders):
        try:
            return await e.aembed_query(text)
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if i + 1 < len(embedders):
                print(f"[embed] key {i} failed, trying fallback: {exc!r}")
    raise last_exc


async def store_embedding(
    message_id: str,
    user_id: str,
    session_id: str,
    role: str,
    content: str,
) -> None:
    try:
        vec = await embed(content)
    except Exception:  # noqa: BLE001
        return  # embedding failure must not break chat

    def _call() -> None:
        _client().table("message_embeddings").upsert(
            {
                "message_id": message_id,
                "user_id": user_id,
                "session_id": session_id,
                "role": role,
                "content": content,
                "embedding": vec,
            }
        ).execute()

    try:
        await asyncio.to_thread(_call)
    except Exception:  # noqa: BLE001
        pass


async def retrieve_context(
    user_id: str, query: str, exclude_session: str
) -> str:
    """Return a formatted context block from the user's other sessions."""
    try:
        qvec = await embed(query)
    except Exception:  # noqa: BLE001
        return ""

    def _call():
        return (
            _client()
            .rpc(
                "match_user_messages",
                {
                    "query_embedding": qvec,
                    "p_user_id": user_id,
                    "p_exclude_session": exclude_session,
                    "match_count": TOP_K,
                },
            )
            .execute()
        )

    try:
        res = await asyncio.to_thread(_call)
    except Exception:  # noqa: BLE001
        return ""

    rows = [
        r
        for r in (res.data or [])
        if r.get("similarity", 0) >= MIN_SIMILARITY
    ]
    if not rows:
        return ""

    # Newest first so the model can prefer recent facts on conflict.
    rows.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    lines = [f"- {r['content']}" for r in rows]
    return (
        "The user said the following in earlier chats, ordered "
        "MOST RECENT FIRST. If statements conflict (e.g. a fact was "
        "updated), trust the most recent one. Use only if relevant:\n"
        + "\n".join(lines)
    )
