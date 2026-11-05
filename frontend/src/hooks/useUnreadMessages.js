import { useCallback, useEffect, useRef, useState } from "react";
import { getConversations } from "../api/messagingApi";
import useAuth from "./useAuth";
import useMessageSocket from "./useMessageSocket";

export default function useUnreadMessages() {
  const { token } = useAuth();
  const [result, setResult] = useState({ token: null, count: 0 });
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
      setResult({ token, count });
    } catch {
      // Keep the last confirmed count until a later refresh succeeds.
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

  return result.token === token ? result.count : 0;
}
