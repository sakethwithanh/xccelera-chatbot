import { supabase } from "./lib/supabase";

const BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function authHeader(forceRefresh = false) {
  if (forceRefresh) await supabase.auth.refreshSession();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}, retried = false) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(await authHeader(retried)),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401 && !retried) {
    // Expired JWT — refresh the Supabase session and retry once.
    return request(path, options, true);
  }
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  listSessions: () => request("/api/sessions"),
  createSession: (title) =>
    request("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ title: title ?? null }),
    }),
  listMessages: (sessionId) =>
    request(`/api/sessions/${sessionId}/messages`),
  listNews: () => request("/api/news"),
  discussArticle: (articleId) =>
    request(`/api/news/${articleId}/discuss`, { method: "POST" }),
  sendChat: (sessionId, message) =>
    request("/api/chat", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, message }),
    }),
  streamChat: async (sessionId, message, { onDelta, signal }) => {
    const open = async (forceRefresh) =>
      fetch(`${BASE}/api/chat/stream`, {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader(forceRefresh)),
        },
        body: JSON.stringify({ session_id: sessionId, message }),
      });
    let res = await open(false);
    if (res.status === 401) res = await open(true); // refresh + retry once
    if (!res.ok || !res.body) {
      throw new Error(`${res.status}: ${await res.text()}`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 2);
        if (!line.startsWith("data:")) continue;
        const evt = JSON.parse(line.slice(5).trim());
        if (evt.delta) onDelta(evt.delta);
        else if (evt.error) throw new Error(evt.error);
      }
    }
  },
};
