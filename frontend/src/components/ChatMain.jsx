import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useSpeechSynthesis } from "../hooks/useSpeech";
import Composer from "./Composer";
import { Icon } from "./icons";

const SUGGESTED = [
  "What can you do, and how do you stay in context across our chats?",
  "Brainstorm 5 product name ideas for a privacy-first note-taking app",
  "Draft a polite follow-up email after a job interview",
  "Explain how vector embeddings work, in simple terms",
];

function Message({ msg, initials, speech }) {
  const me = msg.role === "user";
  const speaking = speech.speakingId === msg.id;
  return (
    <div className={`msg${me ? " me" : ""}`}>
      <div className={`ava ${me ? "me" : "ai"}`} aria-hidden="true">
        {me ? initials : <img src="/axis-icon.png" alt="" className="ava-img" />}
      </div>
      <div className="bubble-col">
        <div className="meta-row">
          <span>{me ? "You" : "Axis"}</span>
          {!me && <span className="model">axis · context-aware</span>}
        </div>
        <div className={`bubble ${me ? "me" : "ai"}`}>
          {me ? (
            msg.content
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: (pr) => <a {...pr} target="_blank" rel="noreferrer" />,
              }}
            >
              {msg.content}
            </ReactMarkdown>
          )}
        </div>
        {!me && (
          <div className="bubble-actions">
            <button
              className="b-action"
              title="Copy"
              onClick={() => navigator.clipboard?.writeText(msg.content)}
            >
              <Icon.copy width="14" height="14" />
            </button>
            {speech.supported && (
              <button
                className="b-action"
                title={speaking ? "Stop" : "Read aloud"}
                onClick={() => speech.speak(msg.id, msg.content)}
                style={speaking ? { color: "var(--c-cyan)" } : undefined}
              >
                {speaking ? (
                  <Icon.stop width="13" height="13" />
                ) : (
                  <Icon.volume width="14" height="14" />
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="msg">
      <div className="ava ai" aria-hidden="true">
        <img src="/axis-icon.png" alt="" className="ava-img" />
      </div>
      <div className="bubble-col">
        <div className="meta-row">
          <span>Axis</span> <span className="model">thinking…</span>
        </div>
        <div className="bubble ai">
          <span className="typing">
            <span />
            <span />
            <span />
          </span>
        </div>
      </div>
    </div>
  );
}

function EmptyConv({ onPick, userName }) {
  return (
    <div className="empty-conv">
      <div className="ava ai big" aria-hidden="true">
        <img src="/axis-icon.png" alt="" className="ava-img big" />
      </div>
      <h2>
        Hi {userName || "there"}, how can <em>Axis</em> help?
      </h2>
      <p className="muted">
        I remember everything you say in this conversation — and recall what you
        told me in other chats too.
      </p>
      <div className="suggest">
        {SUGGESTED.map((t, i) => (
          <button key={i} onClick={() => onPick(t)}>
            {t}
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
  const initials = (userName || "U").slice(0, 2).toUpperCase();

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const awaitingFirstToken = !lastAssistant || lastAssistant.content === "";
  const empty = messages.length === 0 && !sending;

  return (
    <section className="main">
      <header className="conv-head">
        {!sidebarOpen && (
          <button className="icon-btn" onClick={onShowSidebar} aria-label="Sidebar">
            <Icon.sidebar width="14" height="14" />
          </button>
        )}
        <div className="title-row">
          <h1>{title}</h1>
          <span className="pill">
            <span className="dot" /> Context-aware · Axis
          </span>
        </div>
      </header>

      <div className="conv scroll" ref={scrollRef}>
        {empty ? (
          <EmptyConv onPick={(t) => onSend(t)} userName={userName} />
        ) : (
          <>
            {messages
              .filter((m) => !(m.role === "assistant" && m.content === ""))
              .map((m) => (
                <Message key={m.id} msg={m} initials={initials} speech={speech} />
              ))}
            {sending && awaitingFirstToken && <Typing />}
            {error && <div className="conv-error">{error}</div>}
          </>
        )}
      </div>

      <Composer
        value={draft}
        onChange={setDraft}
        onSend={() => onSend()}
        onStop={onStop}
        streaming={sending}
        disabled={sending}
      />
    </section>
  );
}
