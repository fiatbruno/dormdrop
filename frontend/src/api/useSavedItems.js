import { useCallback, useEffect, useState } from "react";
import api from "./client";
import config from "./savedItemsConfig";

export default function useSavedItems() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadItems = useCallback(async (signal) => {
    setLoading(true);
    setError("");

    try {
      if (!config.listPath || !config.selectItems) {
        setItems([]);
        return;
      }

      const response = await api.get(config.listPath, { signal });
      const savedItems = config.selectItems(response.data);

      if (!Array.isArray(savedItems)) {
        throw new Error("Could not read the saved items response.");
      }

      if (!signal?.aborted) setItems(savedItems);
    } catch (err) {
      if (!signal?.aborted) {
        setError(
          err.response
            ? "Couldn't load saved items. Please try again."
            : err.message,
        );
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadItems(controller.signal);

    return () => controller.abort();
  }, [loadItems]);

  async function unsave(id) {
    const item = items.find((item) => item.id === id);
    const request = config.unsaveRequest?.(item);

    if (!request?.url || !request.method) {
      throw new Error("Unsave is not connected yet.");
    }

    await api.request(request);
    setItems((previous) => previous.filter((item) => item.id !== id));
  }

  return {
    items,
    loading,
    error,
    onRetry: () => loadItems(),
    onUnsave: config.unsaveRequest ? unsave : undefined,
    getListingPath: config.detailPath,
  };
}
