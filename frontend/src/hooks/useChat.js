import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";

export function useChat(sessionId) {
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    api
      .listMessages(sessionId)
      .then((rows) => !cancelled && setMessages(rows))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const sendMessage = useCallback(
    async (text) => {
      if (!sessionId || !text.trim() || sending) return;
      setError(null);
      setSending(true);

      const userMsg = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
      };
      const aid = `a-${Date.now()}`;
      const botMsg = {
        id: aid,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      };
      setMessages((m) => [...m, userMsg, botMsg]);

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        await api.streamChat(sessionId, text, {
          signal: controller.signal,
          onDelta: (d) =>
            setMessages((m) =>
              m.map((x) =>
                x.id === aid ? { ...x, content: x.content + d } : x,
              ),
            ),
        });
      } catch (e) {
        if (e.name === "AbortError") {
          // User stopped — keep whatever streamed so far.
        } else {
          setError(e.message);
          setMessages((m) =>
            m.filter((x) => !(x.id === aid && x.content === "")),
          );
        }
      } finally {
        setSending(false);
        abortRef.current = null;
      }
    },
    [sessionId, sending],
  );

  return { messages, sending, error, sendMessage, stop };
}
