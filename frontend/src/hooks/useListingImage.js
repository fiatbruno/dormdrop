import { useEffect, useState } from "react";
import api from "../api/client";
import useAuth from "./useAuth";

export default function useListingImage(source) {
  const { token } = useAuth();
  const [loaded, setLoaded] = useState(null);
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
        // Keep the placeholder if the image is unavailable.
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageUrl, protectedImage, token]);

  if (!protectedImage) return imageUrl || "";
  return loaded?.source === imageUrl && loaded.token === token ? loaded.url : "";
}
