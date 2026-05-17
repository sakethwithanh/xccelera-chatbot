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
TOP_K = 4
MIN_SIMILARITY = 0.65


@lru_cache
def _embeddings() -> GoogleGenerativeAIEmbeddings:
    return GoogleGenerativeAIEmbeddings(
        model=EMBED_MODEL,
        google_api_key=get_settings().gemini_api_key,
        output_dimensionality=EMBED_DIM,
    )


async def embed(text: str) -> list[float]:
    return await _embeddings().aembed_query(text)


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

    lines = [f"- ({r['role']}) {r['content']}" for r in rows]
    return (
        "Relevant context from this user's earlier conversations "
        "(other chats). Use only if relevant:\n" + "\n".join(lines)
    )
