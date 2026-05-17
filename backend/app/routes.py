import json

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessageChunk, HumanMessage

from . import db
from .auth import current_user_id
from .runtime import ensure_graph
from .schemas import (
    ChatRequest,
    ChatResponse,
    MessageOut,
    SessionCreate,
    SessionOut,
)

router = APIRouter(prefix="/api")


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
    await db.add_message(body.session_id, "user", body.message)

    # First message in an untitled session -> derive a title from it.
    if not session.get("title"):
        snippet = " ".join(body.message.split())[:48].strip()
        await db.update_session_title(body.session_id, snippet or "New chat")

    # LangGraph: thread_id == session_id. The checkpointer loads prior state
    # for this thread, so the model answers with full conversation context.
    graph = await ensure_graph(request.app)
    result = await graph.ainvoke(
        {"messages": [HumanMessage(body.message)]},
        config={"configurable": {"thread_id": body.session_id}},
    )
    reply = result["messages"][-1].content

    await db.add_message(body.session_id, "assistant", reply)
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

    await db.add_message(body.session_id, "user", body.message)
    if not session.get("title"):
        snippet = " ".join(body.message.split())[:48].strip()
        await db.update_session_title(body.session_id, snippet or "New chat")

    graph = await ensure_graph(request.app)

    async def gen():
        full = ""
        try:
            async for chunk, _meta in graph.astream(
                {"messages": [HumanMessage(body.message)]},
                config={"configurable": {"thread_id": body.session_id}},
                stream_mode="messages",
            ):
                if isinstance(chunk, AIMessageChunk):
                    tok = _chunk_text(chunk.content)
                    if tok:
                        full += tok
                        yield f"data: {json.dumps({'delta': tok})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as exc:  # noqa: BLE001
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        finally:
            # Persist whatever was generated (covers client-abort too).
            if full:
                try:
                    await db.add_message(
                        body.session_id, "assistant", full
                    )
                except Exception:  # noqa: BLE001
                    pass

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
