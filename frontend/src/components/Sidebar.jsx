import { Icon } from "./icons";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function groupSessions(sessions) {
  const today = startOfDay(new Date());
  const dayMs = 86400000;
  const groups = { Today: [], Yesterday: [], "Last 7 days": [], Older: [] };
  for (const s of sessions) {
    const created = startOfDay(s.created_at);
    const diff = Math.round((today - created) / dayMs);
    if (diff <= 0) groups.Today.push(s);
    else if (diff === 1) groups.Yesterday.push(s);
    else if (diff <= 7) groups["Last 7 days"].push(s);
    else groups.Older.push(s);
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
      <div className="sidebar-head">
        <img className="sidebar-logo" src="/logo.webp" alt="Xccelera" />
        <button
          className="sidebar-collapse"
          onClick={onCollapse}
          title="Collapse sidebar"
        >
          <Icon.sidebar />
        </button>
      </div>

      <button className="new-chat-btn" onClick={onNew} disabled={creating}>
        <Icon.plus /> New chat
      </button>

      <div className="sidebar-search">
        <Icon.search />
        <input
          placeholder="Search chats…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>

      <div className="sidebar-scroll">
        {grouped.length === 0 && (
          <div className="sidebar-empty">
            {q ? "No chats match your search." : "No conversations yet."}
          </div>
        )}
        {grouped.map(([group, items]) => (
          <div key={group}>
            <div className="sidebar-section">{group}</div>
            {items.map((c) => (
              <button
                key={c.id}
                className={`conv-item${c.id === activeId ? " active" : ""}`}
                onClick={() => onSelect(c.id)}
              >
                <span className="conv-title">{titleFor(c)}</span>
                {c.id === activeId && <span className="conv-dot" />}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="user-card">
        <div className="user-avatar">{initials}</div>
        <div className="user-info">
          <div className="user-name">{displayName}</div>
          <div className="user-plan">{user?.email}</div>
        </div>
        <button className="icon-btn" title="Sign out" onClick={onSignOut}>
          <Icon.logout />
        </button>
      </div>
    </aside>
  );
}
