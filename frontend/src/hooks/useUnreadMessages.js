import { useCallback, useEffect, useRef, useState } from "react";
import { getConversations } from "../api/messagingApi";
import useAuth from "./useAuth";
import useMessageSocket from "./useMessageSocket";

export default function useUnreadMessages() {
  const { token } = useAuth();
  const [result, setResult] = useState({ token: null, count: 0, conversations: [], error: false });
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    if (!token) return;
    const request = ++generation.current;
    try {
      const conversations = await getConversations();
      if (request !== generation.current || !Array.isArray(conversations)) return;
      const count = conversations.reduce((total, conversation) => {
        const unread = Number(conversation.unreadCount);
        return total + (Number.isFinite(unread) && unread > 0 ? unread : 0);
      }, 0);
      setResult({ token, count, conversations: conversations.filter((item) => Number(item.unreadCount) > 0), error: false });
    } catch {
      if (request === generation.current) {
        setResult((previous) => previous.token === token
          ? { ...previous, error: true }
          : { token, count: 0, conversations: [], error: true });
      }
    }
  }, [token]);

  useMessageSocket(refresh, refresh);

  useEffect(() => {
    if (!token) return undefined;
    const requestGeneration = generation;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch the initial unread count for the active session.
    void refresh();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("dormdrop:messages-updated", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const timer = window.setInterval(refreshWhenVisible, 15_000);
    return () => {
      requestGeneration.current++;
      window.clearInterval(timer);
      window.removeEventListener("dormdrop:messages-updated", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [token, refresh]);

  return {
    count: result.token === token ? result.count : 0,
    conversations: result.token === token ? result.conversations : [],
    error: result.token === token && result.error,
    refresh,
  };
}
