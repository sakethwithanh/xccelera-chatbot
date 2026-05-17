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


def _make_llm() -> ChatGoogleGenerativeAI:
    s = get_settings()
    return ChatGoogleGenerativeAI(
        model=s.gemini_model,
        google_api_key=s.gemini_api_key,
        temperature=0.7,
    )


def build_graph(checkpointer):
    """Compile the conversation graph bound to a checkpointer."""
    settings = get_settings()
    llm = _make_llm()

    async def call_model(state: MessagesState, config) -> dict:
        # Full history lives in the checkpointer; cap what we send to the
        # model for cost/latency. Keep the most recent turns.
        history = state["messages"][-settings.history_limit :]
        prompt = [SystemMessage(SYSTEM_PROMPT)]
        rag = (config or {}).get("configurable", {}).get("rag_context")
        if rag:
            prompt.append(SystemMessage(rag))
        prompt.extend(history)
        response = await llm.ainvoke(prompt)
        return {"messages": [response]}

    builder = StateGraph(MessagesState)
    builder.add_node("model", call_model)
    builder.add_edge(START, "model")
    return builder.compile(checkpointer=checkpointer)
