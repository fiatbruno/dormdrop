import { useEffect, useState } from "react";
import api from "../api/client";
import useAuth from "./useAuth";

export default function useListingImage(source, { withStatus = false } = {}) {
  const { token } = useAuth();
  const [loaded, setLoaded] = useState(null);
  const [failed, setFailed] = useState(null);
  const backend = new URL(api.defaults.baseURL, window.location.origin);
  const url = source ? new URL(source, backend) : null;
  const protectedImage = url?.origin === backend.origin;
  const imageUrl = url?.href;

  useEffect(() => {
    if (!imageUrl || !protectedImage || !token) return;
    const controller = new AbortController();
    let objectUrl;
    api.get(imageUrl, { responseType: "blob", signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(data);
        setLoaded({ source: imageUrl, token, url: objectUrl });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed({ source: imageUrl, token });
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageUrl, protectedImage, token]);

  const resolved = !protectedImage ? imageUrl || ""
    : loaded?.source === imageUrl && loaded.token === token ? loaded.url : "";
  const error = !imageUrl || (protectedImage && (!token ||
    (failed?.source === imageUrl && failed.token === token)));
  return withStatus ? { url: resolved, loading: !resolved && !error, error } : resolved;
}