import json

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessageChunk, HumanMessage

from . import db, news, rag
from .auth import current_user_id
from .config import get_settings
from .runtime import ensure_graph
from .schemas import (
    ChatRequest,
    ChatResponse,
    MessageOut,
    NewsOut,
    SessionCreate,
    SessionOut,
    SettingsIn,
    SettingsOut,
    UsageOut,
)

router = APIRouter(prefix="/api")


async def _article_block(session: dict) -> str:
    """Context block when a session is anchored to a news article."""
    aid = session.get("news_article_id")
    if not aid:
        return ""
    art = await db.get_article(aid)
    if not art:
        return ""
    body = (art.get("content") or art.get("summary") or "")[:7000]
    return (
        "The user is discussing this news article. Ground your answers in "
        "it:\n"
        f"Title: {art['title']}\n"
        f"Source: {art.get('source')}\n"
        f"URL: {art['url']}\n"
        f"Article:\n{body}"
    )


def _merge_context(article_block: str, rag_context: str) -> str:
    return "\n\n".join(b for b in (article_block, rag_context) if b)


TRIAL_EXHAUSTED_MSG = (
    "You've used the free trial messages on Axis. To keep chatting, add your "
    "own Google Gemini API key in **Settings** (sidebar → Settings). It's "
    "free from https://aistudio.google.com/app/apikey and stays on your "
    "account only."
)
SERVICE_ERROR_MSG = (
    "Axis is temporarily unable to reach the free model. Please add your own "
    "Google Gemini API key in **Settings** to continue chatting. It's free "
    "from https://aistudio.google.com/app/apikey."
)


async def _pick_keys(user_id: str) -> tuple[list[str], str]:
    """Return (api_keys, source). source in {'user','free','none'}."""
    s = await db.get_user_settings(user_id)
    if s and s.get("gemini_api_key"):
        return [s["gemini_api_key"]], "user"
    usage = await db.get_usage(user_id)
    if usage.get("free_messages_used", 0) >= get_settings().free_message_limit:
        return [], "none"
    return get_settings().gemini_keys, "free"


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@router.post("/sessions", response_model=SessionOut, status_code=201)
async def create_session(
    body: SessionCreate, user_id: str = Depends(current_user_id)
) -> dict:
    return await db.create_session(user_id, body.title)


@router.get("/sessions", response_model=list[SessionOut])
async def list_sessions(user_id: str = Depends(current_user_id)) -> list[dict]:
    return await db.list_sessions(user_id)


@router.get(
    "/sessions/{session_id}/messages", response_model=list[MessageOut]
)
async def list_messages(
    session_id: str, user_id: str = Depends(current_user_id)
) -> list[dict]:
    if not await db.get_session(session_id, user_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    return await db.list_messages(session_id)


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    request: Request,
    user_id: str = Depends(current_user_id),
) -> ChatResponse:
    # Ownership gate: the session must belong to the authenticated user.
    session = await db.get_session(body.session_id, user_id)
    if not session:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")

    # Mirror the user turn into our table (RLS-owned source of truth for UI).
    user_row = await db.add_message(body.session_id, "user", body.message)

    # First message in an untitled session -> derive a title from it.
    if not session.get("title"):
        snippet = " ".join(body.message.split())[:48].strip()
        await db.update_session_title(body.session_id, snippet or "New chat")

    # RAG: pull relevant memory from this user's OTHER sessions.
    rag_context = await rag.retrieve_context(
        user_id, body.message, body.session_id
    )
    rag_context = _merge_context(await _article_block(session), rag_context)

    # Pick which Gemini key(s) to use: user's own, or server free-trial.
    keys, source = await _pick_keys(user_id)

    if source == "none":
        reply = TRIAL_EXHAUSTED_MSG
        await db.add_message(body.session_id, "assistant", reply)
        return ChatResponse(session_id=body.session_id, reply=reply)

    graph = await ensure_graph(request.app)
    try:
        result = await graph.ainvoke(
            {"messages": [HumanMessage(body.message)]},
            config={
                "configurable": {
                    "thread_id": body.session_id,
                    "rag_context": rag_context,
                    "api_keys": keys,
                }
            },
        )
        reply = result["messages"][-1].content
    except Exception as exc:  # noqa: BLE001
        if source == "user":
            raise
        print(f"[chat] free key failed: {exc!r}")
        reply = SERVICE_ERROR_MSG
        await db.add_message(body.session_id, "assistant", reply)
        return ChatResponse(session_id=body.session_id, reply=reply)

    if source == "free":
        await db.increment_usage(user_id)
    await db.add_message(body.session_id, "assistant", reply)
    # Embed user turns only — they carry the facts/topics worth recalling;
    # assistant text adds noise (e.g. refusals) to similarity search.
    await rag.store_embedding(
        user_row["id"], user_id, body.session_id, "user", body.message
    )
    return ChatResponse(session_id=body.session_id, reply=reply)


def _chunk_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        out = []
        for p in content:
            if isinstance(p, dict):
                out.append(p.get("text", ""))
            else:
                out.append(str(p))
        return "".join(out)
    return ""


@router.post("/chat/stream")
async def chat_stream(
    body: ChatRequest,
    request: Request,
    user_id: str = Depends(current_user_id),
) -> StreamingResponse:
    session = await db.get_session(body.session_id, user_id)
    if not session:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")

    user_row = await db.add_message(body.session_id, "user", body.message)
    if not session.get("title"):
        snippet = " ".join(body.message.split())[:48].strip()
        await db.update_session_title(body.session_id, snippet or "New chat")

    rag_context = await rag.retrieve_context(
        user_id, body.message, body.session_id
    )
    rag_context = _merge_context(await _article_block(session), rag_context)
    keys, source = await _pick_keys(user_id)
    graph = await ensure_graph(request.app)

    async def gen():
        full = ""

        # Quota exhausted — stream a graceful message, no LLM call.
        if source == "none":
            full = TRIAL_EXHAUSTED_MSG
            yield f"data: {json.dumps({'delta': full})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
            try:
                await db.add_message(body.session_id, "assistant", full)
            except Exception:  # noqa: BLE001
                pass
            return

        try:
            async for chunk, _meta in graph.astream(
                {"messages": [HumanMessage(body.message)]},
                config={
                    "configurable": {
                        "thread_id": body.session_id,
                        "rag_context": rag_context,
                        "api_keys": keys,
                    }
                },
                stream_mode="messages",
            ):
                if isinstance(chunk, AIMessageChunk):
                    tok = _chunk_text(chunk.content)
                    if tok:
                        full += tok
                        yield f"data: {json.dumps({'delta': tok})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
            if source == "free":
                try:
                    await db.increment_usage(user_id)
                except Exception:  # noqa: BLE001
                    pass
        except Exception as exc:  # noqa: BLE001
            if source == "free":
                # Hide raw error from end users; ask them to add their key.
                print(f"[chat/stream] free key failed: {exc!r}")
                if not full:
                    full = SERVICE_ERROR_MSG
                    yield f"data: {json.dumps({'delta': full})}\n\n"
                yield f"data: {json.dumps({'done': True})}\n\n"
            else:
                yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        finally:
            # Persist whatever was generated (covers client-abort too).
            if full:
                try:
                    await db.add_message(
                        body.session_id, "assistant", full
                    )
                    # User turns only (see /chat note).
                    await rag.store_embedding(
                        user_row["id"], user_id, body.session_id,
                        "user", body.message,
                    )
                except Exception:  # noqa: BLE001
                    pass

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---- AI News -------------------------------------------------------------


@router.get("/news", response_model=list[NewsOut])
async def get_news(_user_id: str = Depends(current_user_id)) -> list[dict]:
    return await db.list_news()


# GET + POST: Vercel Cron calls GET with `Authorization: Bearer $CRON_SECRET`
# (auto-injected); manual/curl can use POST with `x-cron-secret`.
@router.api_route("/news/refresh", methods=["GET", "POST"])
async def refresh_news(
    x_cron_secret: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    secret = get_settings().cron_secret
    bearer = (
        authorization.removeprefix("Bearer ").strip()
        if authorization
        else None
    )
    if not secret or (x_cron_secret != secret and bearer != secret):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Bad cron secret")
    return await news.refresh()


@router.post("/news/{article_id}/discuss", response_model=SessionOut)
async def discuss_article(
    article_id: str, user_id: str = Depends(current_user_id)
) -> dict:
    art = await db.get_article(article_id)
    if not art:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Article not found")
    # Lazily fetch full article body the first time it's discussed.
    if art.get("content") == art.get("summary") and art.get("url"):
        full = await news.fetch_full_text(art["url"])
        if full and len(full) > len(art.get("summary") or ""):
            await db.update_article_content(article_id, full)
    title = ("News: " + art["title"])[:60]
    return await db.create_session(user_id, title, news_article_id=article_id)


# ---- Per-user settings + usage -------------------------------------------


@router.get("/settings", response_model=SettingsOut)
async def get_settings_route(user_id: str = Depends(current_user_id)) -> dict:
    s = await db.get_user_settings(user_id)
    return {
        "has_key": bool(s and s.get("gemini_api_key")),
        "updated_at": s.get("updated_at") if s else None,
    }


@router.put("/settings", response_model=SettingsOut)
async def put_settings(
    body: SettingsIn, user_id: str = Depends(current_user_id)
) -> dict:
    key = (body.gemini_api_key or "").strip() or None
    row = await db.upsert_user_settings(user_id, key)
    return {"has_key": bool(key), "updated_at": row.get("updated_at")}


@router.delete("/settings", response_model=SettingsOut)
async def delete_settings(user_id: str = Depends(current_user_id)) -> dict:
    row = await db.upsert_user_settings(user_id, None)
    return {"has_key": False, "updated_at": row.get("updated_at")}


@router.get("/usage", response_model=UsageOut)
async def get_usage_route(user_id: str = Depends(current_user_id)) -> dict:
    s = await db.get_user_settings(user_id)
    usage = await db.get_usage(user_id)
    return {
        "free_messages_used": usage.get("free_messages_used", 0),
        "free_limit": get_settings().free_message_limit,
        "has_key": bool(s and s.get("gemini_api_key")),
    }
