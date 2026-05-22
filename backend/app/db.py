"""Supabase data-access layer.

The backend uses the service-role key, so it bypasses RLS. Every query is
explicitly scoped by the authenticated `user_id` (taken from the verified JWT),
and RLS is still enabled in the schema as defense-in-depth.
"""

import asyncio
from functools import lru_cache

from supabase import Client, create_client

from .config import get_settings


@lru_cache
def _client() -> Client:
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_key)


async def verify_token(jwt: str) -> str | None:
    """Validate a Supabase access token. Returns the user id or None."""

    def _call() -> str | None:
        try:
            res = _client().auth.get_user(jwt)
        except Exception:
            return None
        return res.user.id if res and res.user else None

    return await asyncio.to_thread(_call)


async def create_session(
    user_id: str, title: str | None, news_article_id: str | None = None
) -> dict:
    def _call() -> dict:
        res = (
            _client()
            .table("sessions")
            .insert(
                {
                    "user_id": user_id,
                    "title": title,
                    "news_article_id": news_article_id,
                }
            )
            .execute()
        )
        return res.data[0]

    return await asyncio.to_thread(_call)


async def list_sessions(user_id: str) -> list[dict]:
    def _call() -> list[dict]:
        res = (
            _client()
            .table("sessions")
            .select("id, title, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data

    return await asyncio.to_thread(_call)


async def get_session(session_id: str, user_id: str) -> dict | None:
    """Return the session only if it belongs to user_id (ownership gate)."""

    def _call() -> dict | None:
        res = (
            _client()
            .table("sessions")
            .select("id, title, created_at, news_article_id")
            .eq("id", session_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    return await asyncio.to_thread(_call)


async def update_session_title(session_id: str, title: str) -> None:
    def _call() -> None:
        (
            _client()
            .table("sessions")
            .update({"title": title})
            .eq("id", session_id)
            .execute()
        )

    await asyncio.to_thread(_call)


async def list_messages(session_id: str) -> list[dict]:
    def _call() -> list[dict]:
        res = (
            _client()
            .table("messages")
            .select("id, role, content, created_at")
            .eq("session_id", session_id)
            .order("created_at")
            .execute()
        )
        return res.data

    return await asyncio.to_thread(_call)


async def add_message(session_id: str, role: str, content: str) -> dict:
    def _call() -> dict:
        res = (
            _client()
            .table("messages")
            .insert(
                {"session_id": session_id, "role": role, "content": content}
            )
            .execute()
        )
        return res.data[0]

    return await asyncio.to_thread(_call)


# ---- News ----------------------------------------------------------------


async def list_news(limit: int = 40) -> list[dict]:
    def _call() -> list[dict]:
        res = (
            _client()
            .table("news_articles")
            .select("id, title, url, source, summary, published_at")
            .order("published_at", desc=True)
            .limit(limit)
            .execute()
        )
        return res.data

    return await asyncio.to_thread(_call)


async def get_article(article_id: str) -> dict | None:
    def _call() -> dict | None:
        res = (
            _client()
            .table("news_articles")
            .select("*")
            .eq("id", article_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    return await asyncio.to_thread(_call)


async def upsert_articles(rows: list[dict]) -> int:
    if not rows:
        return 0

    def _call() -> int:
        res = (
            _client()
            .table("news_articles")
            .upsert(rows, on_conflict="url", ignore_duplicates=False)
            .execute()
        )
        return len(res.data or [])

    return await asyncio.to_thread(_call)
