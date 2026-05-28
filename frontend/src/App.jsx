import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import ChatMain from "./components/ChatMain";
import Login from "./components/Login";
import NewsPage from "./components/NewsPage";
import ResetPassword from "./components/ResetPassword";
import Settings from "./components/Settings";
import Sidebar from "./components/Sidebar";
import World from "./components/World";
import { useAuth } from "./contexts/AuthContext";
import { useChat } from "./hooks/useChat";

function lastKey(userId) {
  return `axis:last-session:${userId}`;
}

function snippet(text) {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 44 ? t.slice(0, 44) + "…" : t;
}

export default function App() {
  const { user, loading, signOut, recovery } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window === "undefined" || window.innerWidth > 760,
  );
  const [titleOverrides, setTitleOverrides] = useState({});
  const [draft, setDraft] = useState("");
  const [view, setView] = useState("chat"); // "chat" | "news"

  const { messages, sending, error, sendMessage, stop } = useChat(activeId);

  const titleFor = useCallback(
    (s) => s.title || titleOverrides[s.id] || "New chat",
    [titleOverrides],
  );

  const newSession = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const s = await api.createSession(null);
      setSessions((prev) => [s, ...prev]);
      setActiveId(s.id);
      setSearch("");
      if (user) localStorage.setItem(lastKey(user.id), s.id);
    } finally {
      setCreating(false);
    }
  }, [creating, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setReady(false);
    setInitError(null);
    (async () => {
      try {
        const rows = await api.listSessions();
        if (cancelled) return;
        setSessions(rows);
        const remembered = localStorage.getItem(lastKey(user.id));
        const pick = rows.find((r) => r.id === remembered) || rows[0];
        if (pick) {
          setActiveId(pick.id);
        } else {
          const s = await api.createSession(null);
          if (cancelled) return;
          setSessions([s]);
          setActiveId(s.id);
        }
        setReady(true);
      } catch (e) {
        if (cancelled) return;
        setInitError(e.message || "Could not reach the backend.");
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  function select(id) {
    setActiveId(id);
    setDraft("");
    setView("chat");
    if (user) localStorage.setItem(lastKey(user.id), id);
    if (window.innerWidth <= 760) setSidebarOpen(false);
  }

  function onDiscuss(session) {
    setSessions((prev) => [session, ...prev]);
    setActiveId(session.id);
    setDraft("");
    setView("chat");
    if (user) localStorage.setItem(lastKey(user.id), session.id);
    if (window.innerWidth <= 760) setSidebarOpen(false);
  }

  function handleSend(textArg) {
    const text = (textArg ?? draft).trim();
    if (!text || sending || !activeId) return;
    if (messages.length === 0 && !titleOverrides[activeId]) {
      setTitleOverrides((m) => ({ ...m, [activeId]: snippet(text) }));
    }
    setDraft("");
    sendMessage(text);
  }

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId),
    [sessions, activeId],
  );
  const headerTitle = activeSession
    ? titleFor(activeSession)
    : "New conversation";
  const firstName = (
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || ""
  ).split(" ")[0];

  if (loading) {
    return <div className="app-loader">Loading…</div>;
  }

  if (recovery) return <ResetPassword />;
  if (!user) return <Login />;

  return (
    <>
    <World />
    <div className={`app${sidebarOpen ? "" : " no-sidebar"}`}>
      {sidebarOpen && (
        <Sidebar
          sessions={sessions}
          titleFor={titleFor}
          activeId={activeId}
          search={search}
          onSearch={setSearch}
          onSelect={select}
          onNew={newSession}
          onCollapse={() => setSidebarOpen(false)}
          onSignOut={signOut}
          user={user}
          creating={creating}
          view={view}
          onShowNews={() => {
            setView("news");
            if (window.innerWidth <= 760) setSidebarOpen(false);
          }}
          onShowSettings={() => {
            setView("settings");
            if (window.innerWidth <= 760) setSidebarOpen(false);
          }}
        />
      )}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {view === "settings" ? (
        <Settings
          sidebarOpen={sidebarOpen}
          onShowSidebar={() => setSidebarOpen(true)}
        />
      ) : view === "news" ? (
        <NewsPage
          sidebarOpen={sidebarOpen}
          onShowSidebar={() => setSidebarOpen(true)}
          onDiscuss={onDiscuss}
        />
      ) : !ready ? (
        <div className="app-loader" style={{ position: "static" }}>
          Loading conversation…
        </div>
      ) : initError ? (
        <div className="init-error">
          <h2>Can’t reach the backend</h2>
          <p>{initError}</p>
          <p className="hint">
            Check that the FastAPI server is running with real Supabase + Gemini
            keys, the schema is applied, and CORS allows this origin.
          </p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      ) : (
        <ChatMain
          title={headerTitle}
          sidebarOpen={sidebarOpen}
          onShowSidebar={() => setSidebarOpen(true)}
          messages={messages}
          sending={sending}
          error={error}
          draft={draft}
          setDraft={setDraft}
          onSend={handleSend}
          onStop={stop}
          userName={firstName}
        />
      )}
    </div>
    </>
  );
}
