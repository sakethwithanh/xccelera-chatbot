import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useSpeechSynthesis } from "../hooks/useSpeech";
import Composer from "./Composer";
import { Icon } from "./icons";

const SUGGESTED = [
  {
    cat: "Get started",
    text: "What can you do, and how do you stay in context across our chat?",
    hint: "Explains the assistant",
  },
  {
    cat: "Brainstorm",
    text: "Brainstorm 5 product name ideas for a privacy-first note-taking app",
    hint: "Creative ideation",
  },
  {
    cat: "Write",
    text: "Draft a polite follow-up email after a job interview",
    hint: "Drafting & tone",
  },
  {
    cat: "Learn",
    text: "Explain how vector embeddings work, in simple terms",
    hint: "Plain-English explainer",
  },
];

function Message({ msg, speech }) {
  if (msg.role === "user") {
    return (
      <div className="msg user">
        <div className="msg-body">
          <div className="msg-bubble">{msg.content}</div>
        </div>
      </div>
    );
  }
  const speaking = speech.speakingId === msg.id;
  return (
    <div className="msg bot">
      <div className="bot-avatar">
        <Icon.spark style={{ width: 16, height: 16, color: "#fff" }} />
      </div>
      <div className="msg-body">
        <div className="msg-bubble markdown">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: (props) => (
                <a {...props} target="_blank" rel="noreferrer" />
              ),
            }}
          >
            {msg.content}
          </ReactMarkdown>
        </div>
        <div className="msg-actions">
          <button
            className="msg-action"
            title="Copy"
            onClick={() => navigator.clipboard?.writeText(msg.content)}
          >
            <Icon.copy />
          </button>
          {speech.supported && (
            <button
              className={`msg-action${speaking ? " on" : ""}`}
              title={speaking ? "Stop" : "Read aloud"}
              onClick={() => speech.speak(msg.id, msg.content)}
            >
              {speaking ? <Icon.stopSquare /> : <Icon.volume />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="msg bot">
      <div className="bot-avatar">
        <Icon.spark style={{ width: 16, height: 16, color: "#fff" }} />
      </div>
      <div className="msg-body">
        <div
          className="msg-bubble"
          style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--muted)" }}
        >
          <div>
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
          <span style={{ fontSize: 12.5 }}>Thinking with full context…</span>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onPick, userName }) {
  return (
    <div className="empty-stage">
      <div className="empty-mark">
        <Icon.spark style={{ width: 28, height: 28, color: "#fff" }} />
      </div>
      <h2 className="empty-title">
        {userName ? `Hi ${userName} — how can Axis help?` : "How can Axis help you today?"}
      </h2>
      <p className="empty-sub">
        I remember everything you say in this conversation and answer with full
        context. Ask me anything to get started.
      </p>
      <div className="prompt-grid">
        {SUGGESTED.map((p, i) => (
          <button key={i} className="prompt-card" onClick={() => onPick(p.text)}>
            <span className="pc-cat">{p.cat}</span>
            <span className="pc-text">{p.text}</span>
            <span className="pc-hint">{p.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChatMain({
  title,
  sidebarOpen,
  onShowSidebar,
  messages,
  sending,
  error,
  draft,
  setDraft,
  onSend,
  onStop,
  userName,
}) {
  const scrollRef = useRef(null);
  const speech = useSpeechSynthesis();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  const awaitingFirstToken = !lastAssistant || lastAssistant.content === "";

  return (
    <main className="chat-main">
      <header className="chat-header">
        {!sidebarOpen && (
          <button
            className="icon-btn"
            onClick={onShowSidebar}
            title="Show sidebar"
          >
            <Icon.sidebar />
          </button>
        )}
        <div className="chat-header-title">
          <span className="h-title">{title}</span>
          <span className="h-pill">
            <span className="ping" /> Context-aware
          </span>
        </div>
      </header>

      {messages.length === 0 && !sending ? (
        <EmptyState onPick={(t) => onSend(t)} userName={userName} />
      ) : (
        <div className="chat-scroll" ref={scrollRef}>
          <div className="msg-list">
            {messages
              .filter(
                (m) => !(m.role === "assistant" && m.content === ""),
              )
              .map((m) => (
                <Message key={m.id} msg={m} speech={speech} />
              ))}
            {sending && awaitingFirstToken && <ThinkingBubble />}
          </div>
        </div>
      )}

      {error && <div className="chat-error">{error}</div>}

      <Composer
        value={draft}
        onChange={setDraft}
        onSend={() => onSend()}
        onStop={onStop}
        streaming={sending}
        disabled={sending}
      />
    </main>
  );
}
