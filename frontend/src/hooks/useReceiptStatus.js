import { useEffect, useState } from "react";
import { getReceiptStatus } from "../api/offersApi";
import useAuth from "./useAuth";

export default function useReceiptStatus(offerId, pickupVersion) {
  const { token } = useAuth();
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!offerId || !token) return;

    let active = true;
    let pending = false;
    let completed = false;

    async function refresh() {
      if (pending || completed) return;
      pending = true;
      try {
        const status = await getReceiptStatus(offerId);
        completed = Boolean(status?.transaction);
        if (active) setResult({ offerId, token, pickupVersion, attempt, status });
      } catch (error) {
        if (active) setResult({ offerId, token, pickupVersion, attempt, error });
      } finally {
        pending = false;
      }
    }

    void refresh();
    const timer = window.setInterval(refresh, 12_000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [offerId, token, pickupVersion, attempt]);

  const current = result?.offerId === offerId && result?.token === token && (result?.status?.transaction ||
    (result?.pickupVersion === pickupVersion && result?.attempt === attempt)) ? result : null;
  return {
    status: current?.status,
    error: current?.error,
    loading: Boolean(offerId && token) && !current,
    retry: () => setAttempt((value) => value + 1),
  };
}
