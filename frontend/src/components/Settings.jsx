import { useEffect, useState } from "react";
import { api } from "../api";
import { Icon } from "./icons";

export default function Settings({ sidebarOpen, onShowSidebar }) {
  const [usage, setUsage] = useState(null);
  const [hasKey, setHasKey] = useState(false);
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [note, setNote] = useState(null);

  async function load() {
    setErr(null);
    try {
      const u = await api.getUsage();
      setUsage(u);
      setHasKey(u.has_key);
    } catch (e) {
      setErr(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!key.trim()) return setErr("Paste your Gemini API key first.");
    setErr(null);
    setNote(null);
    setBusy(true);
    try {
      await api.putSettings(key.trim());
      setKey("");
      setNote("Saved. Your key is now used for chats.");
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function clear() {
    setErr(null);
    setNote(null);
    setBusy(true);
    try {
      await api.deleteSettings();
      setNote("Key removed. Falling back to the free trial (if any left).");
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const used = usage?.free_messages_used ?? 0;
  const limit = usage?.free_limit ?? 4;
  const left = Math.max(0, limit - used);

  return (
    <section className="main">
      <header className="conv-head">
        {!sidebarOpen && (
          <button className="icon-btn" onClick={onShowSidebar} aria-label="Sidebar">
            <Icon.sidebar width="14" height="14" />
          </button>
        )}
        <div className="title-row">
          <h1>Settings</h1>
          <span className="pill"><span className="dot" /> Account</span>
        </div>
      </header>

      <div className="scroll" style={{ padding: "28px", maxWidth: 720, margin: "0 auto", width: "100%" }}>
        <div className="settings-card">
          <h3>Gemini API key</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Add your own Google Gemini API key. Axis will use it for your chats
            so you're not limited by the shared free trial.
          </p>

          {hasKey ? (
            <div className="auth-msg ok" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon.check width="14" height="14" /> Your key is active — unlimited chats.
            </div>
          ) : (
            <div className="auth-msg" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--ink-1)" }}>
              No personal key. Using the shared free trial: <b>{left}</b> of {limit} messages left.
              <div className="usage-bar" style={{ marginTop: 10 }}>
                <span style={{ width: `${(used / limit) * 100}%` }} />
              </div>
            </div>
          )}

          {err && <div className="auth-msg err">{err}</div>}
          {note && <div className="auth-msg ok">{note}</div>}

          <div className="field" style={{ marginTop: 10 }}>
            <label>{hasKey ? "Replace key" : "Paste your Gemini API key"}</label>
            <div className="input">
              <span className="lead"><Icon.lock width="16" height="16" /></span>
              <input
                type={show ? "text" : "password"}
                placeholder="AIza..."
                value={key}
                onChange={(e) => setKey(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <span className="trail">
                <button type="button" onClick={() => setShow(!show)} aria-label="Show key">
                  <Icon.eye width="16" height="16" />
                </button>
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button className="btn btn--primary" onClick={save} disabled={busy}>
              {busy ? "Saving…" : hasKey ? "Update key" : "Save key"}
              <Icon.arrow className="ico" />
            </button>
            {hasKey && (
              <button className="btn btn--ghost" onClick={clear} disabled={busy}>
                <Icon.trash width="14" height="14" /> Remove
              </button>
            )}
          </div>

          <p className="muted" style={{ fontSize: 12, marginTop: 18 }}>
            Get a free key from{" "}
            <a className="link" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
              Google AI Studio
            </a>
            . Your key stays in your account only, never shared.
          </p>
        </div>
      </div>
    </section>
  );
}
