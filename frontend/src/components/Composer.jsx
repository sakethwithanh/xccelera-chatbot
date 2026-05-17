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
    e.target.style.height = Math.min(200, e.target.scrollHeight) + "px";
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

  function toggleMic() {
    if (listening) stop();
    else start();
  }

  return (
    <div className="composer-wrap">
      <div className="composer">
        <textarea
          ref={taRef}
          className="composer-input"
          placeholder={
            listening
              ? "Listening… speak now"
              : "Ask anything — Axis remembers this conversation…"
          }
          rows={1}
          value={value}
          onChange={autoresize}
          onKeyDown={onKey}
        />
        <div className="composer-row">
          {supported && (
            <button
              className={`mic-btn${listening ? " listening" : ""}`}
              onClick={toggleMic}
              disabled={disabled}
              title={listening ? "Stop dictation" : "Voice input"}
              type="button"
            >
              {listening ? <Icon.stopSquare /> : <Icon.mic />}
            </button>
          )}
          <span className="spacer" />
          {streaming ? (
            <button
              className="send-btn stop"
              onClick={onStop}
              title="Stop generating"
              type="button"
            >
              <Icon.stopSquare />
            </button>
          ) : (
            <button
              className="send-btn"
              onClick={clickSend}
              disabled={disabled || !value.trim()}
              title="Send"
            >
              <Icon.send />
            </button>
          )}
        </div>
      </div>
      {error ? (
        <div className="composer-foot" style={{ color: "var(--danger)" }}>
          {error}
        </div>
      ) : (
        <div className="composer-foot">
          Press <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for
          new line · Axis keeps full conversation context
        </div>
      )}
    </div>
  );
}
