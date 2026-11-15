import { useEffect, useRef, useState } from "react";
import ListingImage from "./ListingImage";
import "./ListingPhotos.css";

export const PHOTO_LIMIT = 5;

export function Photo({ photo, fallback, ...props }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!photo.file) return;
    const next = URL.createObjectURL(photo.file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Release browser previews when files change.
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [photo.file]);
  return photo.file ? <img {...props} src={url} /> : <ListingImage {...props} fallback={fallback} src={photo.url} />;
}

export function PhotoGallery({ photos, title, className = "preview-photo", fallback, onPhotoChange }) {
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, Math.max(0, photos.length - 1));
  function changePhoto(next) {
    setSelected(next);
    onPhotoChange?.(next);
  }
  return <div className="listing-gallery">
    {photos.length ? photos.map((photo, photoIndex) => (
      <div key={photo.key || photo.url} hidden={photoIndex !== index}>
        <Photo photo={photo} className={className} alt={`${title || "Listing"} - photo ${photoIndex + 1}`} fallback={fallback} />
      </div>
    )) : fallback}
    {photos.length > 1 && <div className="photo-navigation" aria-label="Photo navigation">
      <button type="button" aria-label="Previous photo" onClick={() => changePhoto((index - 1 + photos.length) % photos.length)}>&lt;</button>
      <span aria-live="polite">{index + 1} / {photos.length}</span>
      <button type="button" aria-label="Next photo" onClick={() => changePhoto((index + 1) % photos.length)}>&gt;</button>
    </div>}
  </div>;
}

export default function ListingPhotos({ photos, onChange, error, onError, disabled }) {
  const input = useRef(null);
  function choose(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    if (photos.length + files.length > PHOTO_LIMIT) {
      onError("You can add up to 5 photos. Remove a photo before adding more.");
      return;
    }
    if (files.some(file => !["image/jpeg", "image/png"].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024)) {
      onError("Choose JPG or PNG photos, up to 5 MB each.");
      return;
    }
    onChange([...photos, ...files.map(file => ({ key: crypto.randomUUID(), file }))]);
    onError("");
  }
  return <>
    <div className="listing-photo-picker">
      <div className="listing-photo-slots">
        {photos.map((photo, index) => <div className="listing-photo-entry" key={photo.key}>
          <Photo photo={photo} alt={`Selected photo ${index + 1}`} fallback={<span>Photo unavailable</span>} />
          <span>{index === 0 ? "COVER PHOTO" : `PHOTO ${index + 1}`}</span>
          <button type="button" disabled={disabled} aria-label={`Remove photo ${index + 1}`} onClick={() => { onChange(photos.filter(item => item.key !== photo.key)); onError(""); }}>Remove</button>
        </div>)}
        {Array.from({ length: Math.max(0, PHOTO_LIMIT - photos.length) }, (_, index) => <button className="listing-add-photo" type="button" disabled={disabled} key={index} onClick={() => input.current?.click()}><strong>+</strong><span>Add photo</span></button>)}
      </div>
      <p>{photos.length} of 5 photos * JPG or PNG * Up to 5 MB each</p>
      <p>Add up to 5 photos. The first photo is your cover.</p>
      <input ref={input} type="file" accept="image/jpeg,image/png" multiple hidden disabled={disabled} onChange={choose} />
    </div>
    {error && <p className="listing-error" role="alert">{error}</p>}
  </>;
}
