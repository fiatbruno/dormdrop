import { useEffect, useState } from "react";
import useAuth from "./useAuth";
import { getUnreadNotificationCount } from "../api/notificationsApi";

const REFRESH_INTERVAL_MS = 15_000;

export default function useUnreadNotificationCount(enabled = true) {
  const { isAuthenticated, token } = useAuth();
  const [result, setResult] = useState({ token: null, count: 0, error: false });

  useEffect(() => {
    if (!enabled || !isAuthenticated || !token) return undefined;

    let active = true;
    let requestPending = false;
    const refresh = async () => {
      if (requestPending) return;
      requestPending = true;
      try {
        const nextCount = await getUnreadNotificationCount();
        if (active) {
          setResult({ token, count: nextCount, error: false });
        }
      } catch {
        if (active) {
          setResult((current) => ({ ...current, token, error: true }));
        }
      } finally {
        requestPending = false;
      }
    };

    void refresh();
    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refresh);
    window.addEventListener("dormdrop:notifications-updated", refresh);
    window.addEventListener("dormdrop:notifications-reconnected", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("dormdrop:notifications-updated", refresh);
      window.removeEventListener("dormdrop:notifications-reconnected", refresh);
    };
  }, [enabled, isAuthenticated, token]);

  return {
    count:
      enabled && isAuthenticated && result.token === token ? result.count : 0,
    error:
      enabled &&
      isAuthenticated &&
      result.token === token &&
      result.error,
  };
}
