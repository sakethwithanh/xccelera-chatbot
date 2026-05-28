"""LangGraph conversation graph.

A minimal `StateGraph` over `MessagesState`: one node calls Gemini with the
running message history. Per-session memory is provided by LangGraph's
`AsyncPostgresSaver` checkpointer (configured in `main.py`), keyed by
`thread_id == session_id`. The checkpointer automatically loads prior state
for a thread, so the model always answers with full conversation context.
"""

from functools import lru_cache

from langchain_core.messages import SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import START, MessagesState, StateGraph

from .config import get_settings

SYSTEM_PROMPT = (
    "You are a helpful, concise assistant in a multi-turn chat. "
    "Use the prior conversation to stay context-aware: remember names, "
    "facts, and preferences the user has shared earlier in this session, "
    "and refer back to them naturally when relevant."
)


@lru_cache(maxsize=64)
def _llm_for(key: str) -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=get_settings().gemini_model,
        google_api_key=key,
        temperature=0.7,
    )


def build_graph(checkpointer):
    """Compile the conversation graph bound to a checkpointer.

    The LLM is built per-request from `config.configurable.api_keys`
    (server primary+fallback, or a single user-supplied key), so the same
    graph serves every user.
    """
    settings = get_settings()

    async def call_model(state: MessagesState, config) -> dict:
        history = state["messages"][-settings.history_limit :]
        prompt = [SystemMessage(SYSTEM_PROMPT)]
        cfg = (config or {}).get("configurable", {})
        rag = cfg.get("rag_context")
        if rag:
            prompt.append(SystemMessage(rag))
        prompt.extend(history)

        keys = cfg.get("api_keys") or get_settings().gemini_keys
        last_exc = None
        for i, k in enumerate(keys):
            try:
                response = await _llm_for(k).ainvoke(prompt)
                return {"messages": [response]}
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                if i + 1 < len(keys):
                    print(f"[gemini] key {i} failed, trying fallback: {exc!r}")
        raise last_exc

    builder = StateGraph(MessagesState)
    builder.add_node("model", call_model)
    builder.add_edge(START, "model")
    return builder.compile(checkpointer=checkpointer)
