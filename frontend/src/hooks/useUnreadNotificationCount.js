import { useEffect, useState } from "react";
import useAuth from "./useAuth";
import { getUnreadNotificationCount } from "../api/notificationsApi";

const REFRESH_INTERVAL_MS = 15_000;

export default function useUnreadNotificationCount(enabled = true) {
  const { isAuthenticated } = useAuth();
  const [count, setCount] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled || !isAuthenticated) return undefined;

    let active = true;
    let requestPending = false;
    const refresh = async () => {
      if (requestPending) return;
      requestPending = true;
      try {
        const nextCount = await getUnreadNotificationCount();
        if (active) {
          setCount(nextCount);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      } finally {
        requestPending = false;
      }
    };

    void refresh();
    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refresh);
    window.addEventListener("dormdrop:notifications-updated", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("dormdrop:notifications-updated", refresh);
    };
  }, [enabled, isAuthenticated]);

  return {
    count: enabled && isAuthenticated ? count : 0,
    error: enabled && isAuthenticated && error,
  };
}
