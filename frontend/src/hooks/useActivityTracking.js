import { useEffect } from "react";
import api from "../api/client";

const INTERVAL_MS = 5 * 60 * 1000;
const RETRY_MS = 30 * 1000;

export default function useActivityTracking(token) {
  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    let nextUpdate = 0;

    const recordInteraction = (event) => {
      if (!event.isTrusted || document.visibilityState !== "visible" || Date.now() < nextUpdate) return;
      nextUpdate = Date.now() + INTERVAL_MS;
      void api.post("/users/me/activity").catch(() => {
        if (active) nextUpdate = Date.now() + RETRY_MS;
      });
    };

    document.addEventListener("pointerdown", recordInteraction, { passive: true });
    document.addEventListener("keydown", recordInteraction);
    document.addEventListener("wheel", recordInteraction, { passive: true });
    return () => {
      active = false;
      document.removeEventListener("pointerdown", recordInteraction);
      document.removeEventListener("keydown", recordInteraction);
      document.removeEventListener("wheel", recordInteraction);
    };
  }, [token]);
}
