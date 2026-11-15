import { useState } from "react";
import useListingImage from "../hooks/useListingImage";

export default function ListingImage({ src, alt, fallback = null, className, ...props }) {
  const { url, loading, error } = useListingImage(src, { withStatus: true });
  const [failedUrl, setFailedUrl] = useState(null);
  if (loading) {
    return <div className={className} role="status" aria-label="Loading photo" aria-busy="true" />;
  }
  if (error || !url || failedUrl === url) return fallback;
  return <img {...props} className={className} src={url} alt={alt} onError={() => setFailedUrl(url)} />;
}