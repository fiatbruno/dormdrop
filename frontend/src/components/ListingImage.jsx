import { useState } from "react";
import useListingImage from "../hooks/useListingImage";

export default function ListingImage({ src, alt, fallback = null, ...props }) {
  const url = useListingImage(src);
  const [failedUrl, setFailedUrl] = useState(null);
  return url && failedUrl !== url ? (
    <img {...props} src={url} alt={alt} onError={() => setFailedUrl(url)} />
  ) : fallback;
}
