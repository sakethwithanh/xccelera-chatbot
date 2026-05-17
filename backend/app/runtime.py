"""Lazy, process-wide LangGraph initialization.

A long-running server initializes the graph in the ASGI lifespan. Vercel
serverless functions do not reliably run lifespan events, so the graph is
also built lazily on first request and cached on the process.

The Postgres checkpointer runs over an async connection *pool* so that
concurrent users (each a separate graph invocation) do not contend on a
single shared connection.
"""

import asyncio

from fastapi import FastAPI
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from .config import get_settings

from .graph import build_graph

_lock = asyncio.Lock()


async def ensure_graph(app: FastAPI):
    if getattr(app.state, "graph", None) is not None:
        return app.state.graph

    async with _lock:
        if getattr(app.state, "graph", None) is not None:
            return app.state.graph

        pool = AsyncConnectionPool(
            conninfo=get_settings().supabase_db_url,
            min_size=1,
            max_size=20,
            open=False,
            kwargs={
                "autocommit": True,
                "prepare_threshold": 0,  # safe with poolers
                "row_factory": dict_row,
            },
        )
        await pool.open()
        checkpointer = AsyncPostgresSaver(pool)
        await checkpointer.setup()  # idempotent

        app.state._cp_pool = pool
        app.state.graph = build_graph(checkpointer)
        return app.state.graph


async def close_graph(app: FastAPI) -> None:
    pool = getattr(app.state, "_cp_pool", None)
    if pool is not None:
        await pool.close()
        app.state._cp_pool = None
        app.state.graph = None
