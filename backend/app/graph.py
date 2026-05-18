"""LangGraph conversation graph.

A minimal `StateGraph` over `MessagesState`: one node calls Gemini with the
running message history. Per-session memory is provided by LangGraph's
`AsyncPostgresSaver` checkpointer (configured in `main.py`), keyed by
`thread_id == session_id`. The checkpointer automatically loads prior state
for a thread, so the model always answers with full conversation context.
"""

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


def _make_llms() -> list[ChatGoogleGenerativeAI]:
    s = get_settings()
    return [
        ChatGoogleGenerativeAI(
            model=s.gemini_model, google_api_key=k, temperature=0.7
        )
        for k in s.gemini_keys
    ]


def build_graph(checkpointer):
    """Compile the conversation graph bound to a checkpointer."""
    settings = get_settings()
    llms = _make_llms()  # [primary, fallback?]

    async def call_model(state: MessagesState, config) -> dict:
        # Full history lives in the checkpointer; cap what we send to the
        # model for cost/latency. Keep the most recent turns.
        history = state["messages"][-settings.history_limit :]
        prompt = [SystemMessage(SYSTEM_PROMPT)]
        rag = (config or {}).get("configurable", {}).get("rag_context")
        if rag:
            prompt.append(SystemMessage(rag))
        prompt.extend(history)
        # Try primary key, fall back to spare on failure (free-tier quota).
        last_exc = None
        for i, llm in enumerate(llms):
            try:
                response = await llm.ainvoke(prompt)
                return {"messages": [response]}
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                if i + 1 < len(llms):
                    print(f"[gemini] key {i} failed, trying fallback: {exc!r}")
        raise last_exc

    builder = StateGraph(MessagesState)
    builder.add_node("model", call_model)
    builder.add_edge(START, "model")
    return builder.compile(checkpointer=checkpointer)
