from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .routes import router
from .runtime import close_graph, ensure_graph

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Long-running server path. Serverless falls back to lazy init per request.
    # A failure here (e.g. DB unreachable) must not block startup or health
    # probes — the graph is retried lazily on the first /api/chat request.
    try:
        await ensure_graph(app)
    except Exception as exc:  # noqa: BLE001
        print(f"[startup] graph init deferred: {exc!r}")
    yield
    await close_graph(app)


app = FastAPI(title="Context-Aware Chatbot", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception) -> JSONResponse:
    # Ensures failures (e.g. missing tables, DB down) return readable JSON.
    # Handler runs inside CORS middleware, so the browser gets the message
    # instead of an opaque "Failed to fetch".
    return JSONResponse(status_code=500, content={"detail": str(exc)})


app.include_router(router)
