import { Icon } from "./icons";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function groupSessions(sessions) {
  const today = startOfDay(new Date());
  const dayMs = 86400000;
  const groups = { Today: [], Yesterday: [], "Last 7 days": [], Earlier: [] };
  for (const s of sessions) {
    const created = startOfDay(s.created_at);
    const diff = Math.round((today - created) / dayMs);
    if (diff <= 0) groups.Today.push(s);
    else if (diff === 1) groups.Yesterday.push(s);
    else if (diff <= 7) groups["Last 7 days"].push(s);
    else groups.Earlier.push(s);
  }
  return Object.entries(groups).filter(([, v]) => v.length > 0);
}

export default function Sidebar({
  sessions,
  titleFor,
  activeId,
  search,
  onSearch,
  onSelect,
  onNew,
  onCollapse,
  onSignOut,
  user,
  creating,
  view,
  onShowNews,
  onShowSettings,
}) {
  const meta = user?.user_metadata || {};
  const displayName = meta.full_name || user?.email?.split("@")[0] || "User";
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const q = search.trim().toLowerCase();
  const filtered = q
    ? sessions.filter((s) => titleFor(s).toLowerCase().includes(q))
    : sessions;
  const grouped = groupSessions(filtered);

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="mark has-img" aria-hidden="true">
          <img src="/axis-icon.png" alt="" />
        </div>
        <div className="wordmark">
          <em>A</em>xis
        </div>
        <button className="toggle" onClick={onCollapse} aria-label="Collapse">
          <Icon.sidebar width="14" height="14" />
        </button>
      </div>

      <a
        className={`nav-item${view === "news" ? " active" : ""}`}
        onClick={onShowNews}
        style={{ cursor: "pointer" }}
      >
        <span className="ico">
          <Icon.news width="16" height="16" />
        </span>
        AI News
      </a>

      <button className="new-chat" onClick={onNew} disabled={creating}>
        <Icon.plus width="14" height="14" />
        New chat
      </button>

      <div className="search">
        <Icon.search width="14" height="14" />
        <input
          placeholder="Search chats…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>

      <div className="chats">
        {grouped.length === 0 && (
          <div className="group-label">
            {q ? "No matches" : "No conversations yet"}
          </div>
        )}
        {grouped.map(([group, items]) => (
          <div key={group}>
            <div className="group-label">{group}</div>
            {items.map((c) => (
              <div
                key={c.id}
                className={`chat-item${c.id === activeId ? " active" : ""}`}
                onClick={() => onSelect(c.id)}
              >
                <span className="label">{titleFor(c)}</span>
                {c.id === activeId && <span className="indicator" />}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="user-card">
        <div className="avatar">{initials}</div>
        <div className="meta">
          <div className="name">{displayName}</div>
          <div className="mail">{user?.email}</div>
        </div>
        <button
          className="out"
          onClick={onShowSettings}
          aria-label="Settings"
          title="Settings"
          style={view === "settings" ? { color: "var(--c-cyan)", borderColor: "rgba(120,200,240,0.4)" } : undefined}
        >
          <Icon.gear width="14" height="14" />
        </button>
        <button className="out" onClick={onSignOut} aria-label="Sign out">
          <Icon.logout width="14" height="14" />
        </button>
      </div>
    </aside>
  );
}
