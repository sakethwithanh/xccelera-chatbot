import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useSpeechSynthesis } from "../hooks/useSpeech";
import { Icon } from "./icons";

function fmtDate(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

const SRC_CLASS = [
  [/verge/i, "verge"],
  [/techcrunch|^tc/i, "tc"],
  [/google/i, "google"],
  [/mit/i, "mit"],
  [/openai/i, "openai"],
  [/anthropic/i, "anthropic"],
];
function srcClass(s = "") {
  for (const [re, c] of SRC_CLASS) if (re.test(s)) return c;
  return "";
}

export default function NewsPage({ sidebarOpen, onShowSidebar, onDiscuss }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [q, setQ] = useState("");
  const [src, setSrc] = useState("All");
  const speech = useSpeechSynthesis();

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

  const sources = useMemo(
    () => ["All", ...Array.from(new Set(items.map((i) => i.source).filter(Boolean)))],
    [items],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((a) => {
      if (src !== "All" && a.source !== src) return false;
      if (!term) return true;
      return (
        a.title?.toLowerCase().includes(term) ||
        a.summary?.toLowerCase().includes(term)
      );
    });
  }, [items, q, src]);

  async function discuss(id) {
    setBusyId(id);
    try {
      onDiscuss(await api.discussArticle(id));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  function readAloud(a) {
    speech.speak(a.id, `${a.title}. ${a.summary || ""}`);
  }

  const hero = filtered[0];
  const secondary = filtered.slice(1, 3);
  const rest = filtered.slice(3);

  function Audio({ a, small }) {
    const on = speech.speakingId === a.id;
    if (!speech.supported) return null;
    return (
      <button
        className="save-btn"
        title={on ? "Stop" : "Read aloud"}
        onClick={() => readAloud(a)}
        style={on ? { color: "var(--c-cyan)", borderColor: "rgba(120,200,240,0.4)" } : undefined}
      >
        {on ? <Icon.stop width={small ? 13 : 15} height={small ? 13 : 15} /> : <Icon.volume width={small ? 14 : 16} height={small ? 14 : 16} />}
      </button>
    );
  }

  function DiscussBtn({ a }) {
    return (
      <button className="read-btn" onClick={() => discuss(a.id)} disabled={busyId === a.id}>
        <Icon.spark width="13" height="13" />
        {busyId === a.id ? "Opening…" : "Discuss with Axis"}
      </button>
    );
  }

  return (
    <section className="main">
      <header className="news-head">
        <div className="head-top">
          <div>
            {!sidebarOpen && (
              <button className="icon-btn" onClick={onShowSidebar} aria-label="Sidebar" style={{ marginBottom: 10 }}>
                <Icon.sidebar width="14" height="14" />
              </button>
            )}
            <h1>The <em>Daily</em> Feed</h1>
            <p className="sub">
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} ·{" "}
              <b>{items.length}</b> stories · personalized to your <b>AI &amp; ML</b> watchlist
            </p>
          </div>
          <div className="stat-row">
            <div className="stat"><span className="num">{items.length}</span><span className="lbl">Stories</span></div>
            <div className="stat"><span className="num">{sources.length - 1}</span><span className="lbl">Sources</span></div>
          </div>
        </div>

        <div className="filter-row">
          <div className="seg">
            {sources.slice(0, 5).map((s) => (
              <button key={s} className={src === s ? "on" : ""} onClick={() => setSrc(s)}>
                {s === "All" ? "For you" : s}
              </button>
            ))}
          </div>
          <span className="spacer" />
          <div className="head-search">
            <Icon.search width="14" height="14" />
            <input placeholder="Search the feed…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </header>

      <div className="scroll feed">
        {loading && <p className="muted">Loading latest AI news…</p>}
        {error && <div className="conv-error">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <p className="muted">No articles match. Try another source or search.</p>
        )}

        {hero && (
          <div className="hero-row">
            <article className="card feature-hero">
              <div className="thumb">
                <span className="glyph">{(hero.source || "AI")[0]}</span>
              </div>
              <div className="meta-line">
                <span className={`src-chip ${srcClass(hero.source)}`}>
                  <span className="swatch" /> {hero.source}
                </span>
                <span style={{ marginLeft: "auto" }}>{fmtDate(hero.published_at)}</span>
              </div>
              <h2>{hero.title}</h2>
              {hero.summary && <p>{hero.summary}</p>}
              <div className="cta-row">
                <DiscussBtn a={hero} />
                <Audio a={hero} />
                <a className="save-btn" href={hero.url} target="_blank" rel="noreferrer" title="Open source">
                  <Icon.arrow width="15" height="15" />
                </a>
              </div>
            </article>

            <div className="col gap-12" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {secondary.map((a) => (
                <article key={a.id} className="card secondary">
                  <div className="meta-line">
                    <span className={`src-chip ${srcClass(a.source)}`}><span className="swatch" /> {a.source}</span>
                    <span style={{ marginLeft: "auto" }}>{fmtDate(a.published_at)}</span>
                  </div>
                  <h3>{a.title}</h3>
                  {a.summary && <p style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.summary}</p>}
                  <div className="foot-row">
                    <DiscussBtn a={a} />
                    <Audio a={a} small />
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {rest.length > 0 && (
          <>
            <div className="date-strip">
              <h2>Latest</h2>
              <span className="ct">{rest.length} more</span>
              <span className="line" />
            </div>
            <div className="grid">
              {rest.map((a) => (
                <article key={a.id} className="card news-card">
                  <div className="meta-line">
                    <span className={`src-chip ${srcClass(a.source)}`}><span className="swatch" /> {a.source}</span>
                    <span style={{ marginLeft: "auto" }}>{fmtDate(a.published_at)}</span>
                  </div>
                  <h3>{a.title}</h3>
                  {a.summary && <p>{a.summary}</p>}
                  <div className="foot-row">
                    <DiscussBtn a={a} />
                    <Audio a={a} small />
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
