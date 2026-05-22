import { useEffect, useState } from "react";
import { api } from "../api";
import { Icon } from "./icons";

export default function NewsPage({ onShowSidebar, sidebarOpen, onDiscuss }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listNews()
      .then((rows) => !cancelled && setItems(rows))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  async function discuss(id) {
    setBusyId(id);
    try {
      const session = await api.discussArticle(id);
      onDiscuss(session);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="chat-main">
      <header className="chat-header">
        {!sidebarOpen && (
          <button className="icon-btn" onClick={onShowSidebar} title="Sidebar">
            <Icon.sidebar />
          </button>
        )}
        <div className="chat-header-title">
          <span className="h-title">AI News</span>
          <span className="h-pill">
            <span className="ping" /> Daily feed
          </span>
        </div>
      </header>

      <div className="news-scroll">
        {loading && <p className="news-empty">Loading latest AI news…</p>}
        {error && <div className="chat-error">{error}</div>}
        {!loading && !error && items.length === 0 && (
          <p className="news-empty">
            No articles yet. Run the news refresh, then reload.
          </p>
        )}
        <div className="news-grid">
          {items.map((a) => (
            <article key={a.id} className="news-card">
              <div className="news-meta">
                <span className="news-source">{a.source}</span>
                {a.published_at && (
                  <span className="news-date">
                    {new Date(a.published_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <a
                className="news-title"
                href={a.url}
                target="_blank"
                rel="noreferrer"
              >
                {a.title}
              </a>
              {a.summary && <p className="news-summary">{a.summary}</p>}
              <button
                className="news-discuss"
                onClick={() => discuss(a.id)}
                disabled={busyId === a.id}
              >
                {busyId === a.id ? "Opening…" : "💬 Discuss with Axis"}
              </button>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
