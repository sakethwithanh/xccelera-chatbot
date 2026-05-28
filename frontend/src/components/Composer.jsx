import { useRef } from "react";
import { useSpeechRecognition } from "../hooks/useSpeech";
import { Icon } from "./icons";

export default function Composer({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  disabled,
}) {
  const taRef = useRef(null);
  const { supported, listening, error, start, stop } =
    useSpeechRecognition(onChange);

  function autoresize(e) {
    onChange(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(220, e.target.scrollHeight) + "px";
  }
  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) {
        onSend();
        if (taRef.current) taRef.current.style.height = "auto";
      }
    }
  }
  function clickSend() {
    if (disabled || !value.trim()) return;
    onSend();
    if (taRef.current) taRef.current.style.height = "auto";
  }

  return (
    <div className="composer-wrap">
      <div className="composer">
        <div className="input-row">
          {supported && (
            <button
              className={`mini-btn${listening ? " on" : ""}`}
              onClick={() => (listening ? stop() : start())}
              disabled={disabled}
              aria-label="Voice"
              type="button"
            >
              {listening ? <Icon.stop width="15" height="15" /> : <Icon.mic width="16" height="16" />}
            </button>
          )}
          <textarea
            ref={taRef}
            placeholder={
              listening
                ? "Listening… speak now"
                : "Ask Axis anything — your past chats are already in context…"
            }
            value={value}
            onChange={autoresize}
            onKeyDown={onKey}
            rows={1}
          />
          {streaming ? (
            <button className="mini-btn stop-btn" onClick={onStop} aria-label="Stop" type="button">
              <Icon.stop width="15" height="15" />
            </button>
          ) : (
            <button
              className="mini-btn send"
              onClick={clickSend}
              disabled={disabled || !value.trim()}
              aria-label="Send"
            >
              <Icon.send width="16" height="16" />
            </button>
          )}
        </div>
        <div className="util-row">
          <span className="chip active">
            <span className="dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c-cyan)" }} />
            Context-aware
          </span>
          <div className="right">
            {error ? (
              <span style={{ color: "var(--c-amber)" }}>{error}</span>
            ) : (
              <span>
                <kbd>⇧</kbd> + <kbd>↵</kbd> for new line
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
