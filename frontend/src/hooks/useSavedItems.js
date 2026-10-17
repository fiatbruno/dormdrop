import { useCallback, useEffect, useState } from "react";
import config from "../api/savedItemsConfig";
import { getFavorites, getListingById, removeFavorite } from "../api/marketplaceApi";

export default function useSavedItems() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadItems = useCallback(async (signal) => {
    setLoading(true);
    setError("");

    try {
      const ids = await getFavorites();
      const results = await Promise.allSettled(ids.map(getListingById));
      const failed = results.find(result => result.status === "rejected" &&
        ![400, 404].includes(result.reason.response?.status));
      if (failed) throw failed.reason;
      const savedItems = results.filter(result => result.status === "fulfilled")
        .map(({ value: item }) => ({
          ...item,
          imageUrl: item.image,
          available: item.status === "AVAILABLE",
          price: item.listingType === "Free / Donate" ? "Free" : item.listingType === "Trade" ? "Trade" : item.price,
        }));

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The shared fetch routine initializes loading for both mount and manual retries.
    loadItems(controller.signal);

    return () => controller.abort();
  }, [loadItems]);

  async function unsave(id) {
    await removeFavorite(id);
    setItems((previous) => previous.filter((item) => item.id !== id));
  }

  return {
    items,
    loading,
    error,
    onRetry: () => loadItems(),
    onUnsave: unsave,
    getListingPath: config.detailPath,
  };
}
