import api from "./client";

function normalizeListing(listing) {
  const id = typeof listing.id === "string"
    ? listing.id
    : listing.id?.$oid;

  const rawPrice = listing.price;

  const price = Number(
    typeof rawPrice === "object" && rawPrice !== null
      ? rawPrice.$numberDecimal
      : rawPrice
  );

  const backendUrl = new URL(api.defaults.baseURL, window.location.origin);
  const imageUrls = Array.isArray(listing.imageUrls) && listing.imageUrls.length
    ? listing.imageUrls
    : listing.imageUrl ? [listing.imageUrl] : [];
  const images = imageUrls.filter(url => typeof url === "string" && url).map(url => new URL(url, backendUrl).href);

  return {
    ...listing,
    id,
    price,
    image: images[0] || "",
    images,
    pickupLocation: listing.pickupArea,
    listedOn: listing.listedOn
      ? listing.listedOn.slice(0, 10)
      : "",
    listingType: listing.listingType || "For sale"
  };
}

export async function getListings({ query = "", signal } = {}) {
  const { data: listings } = await api.get("/home", {
    params: query.trim() ? { q: query.trim() } : undefined,
    signal,
  });
  return listings.map(normalizeListing);
}

export async function getFavorites() {
  const { data } = await api.get("/favorites");
  return data;
}

export async function addFavorite(id) {
  await api.post(`/favorites/${encodeURIComponent(id)}`);
  return null;
}

export async function removeFavorite(id) {
  await api.delete(`/favorites/${encodeURIComponent(id)}`);
  return null;
}

export async function createListing(listing) {
  const { data } = await api.post("/home", {
    title: listing.title,
    description: listing.description,
    category: listing.category,
    price: Number(listing.price),
    condition: listing.condition,
    pickupArea: listing.pickupArea || listing.pickupLocation,
    listingType: listing.listingType || "For sale"
  });
  return data;
}

export async function uploadListingImage(id, file) {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await api.post(`/images/${encodeURIComponent(id)}`, formData);
  return data;
}

export async function getListingById(id) {
  const { data: listing } = await api.get(
    `/home/${encodeURIComponent(id)}`
  );

  return normalizeListing(listing);
}

export async function updateListing(id, listing) {
  const { data } = await api.put(`/home/${encodeURIComponent(id)}`, {
    title: listing.title,
    description: listing.description,
    category: listing.category,
    price: Number(listing.price),
    condition: listing.condition,
    pickupArea: listing.pickupLocation,
    listingType: listing.listingType,
  });
  return data;
}

// Frontend contract for the future multi-photo backend. This request must replace
// the photo collection atomically so retrying cannot duplicate uploaded photos.
export async function saveListingPhotos(id, photos, originalUrls = []) {
  if (photos.every(photo => !photo.file) &&
      photos.length === originalUrls.length &&
      photos.every((photo, index) => photo.url === originalUrls[index])) return;

  const formData = new FormData();
  formData.append("retainedImageUrls", JSON.stringify(photos.filter(photo => !photo.file).map(photo => photo.url)));
  photos.filter(photo => photo.file).forEach(photo => formData.append("files", photo.file));
  try {
    const { data } = await api.put(`/images/${encodeURIComponent(id)}/photos`, formData);
    return data;
  } catch (error) {
    if ([404, 405, 501].includes(error.response?.status)) {
      throw new Error("Photo saving needs the multi-photo backend connection. Your selected photos are still here.");
    }
    if (error.response?.status === 413) {
      throw new Error("The photos are too large to upload. Choose photos up to 5 MB each.");
    }
    const status = error.response?.status;
    const reason = error.response?.data?.detail || error.response?.data?.message;
    const messages = {
      400: "The server rejected the photos. Check that each is JPG/PNG, nonempty, and no larger than 5 MB.",
      401: "Your login expired. Please log in again before saving photos.",
      403: "You do not have permission to change photos on this listing.",
      409: "This listing changed while you were editing. Reload it before saving photos.",
      500: "The backend could not save the photos. Check the backend console for the upload error.",
    };
    const message = typeof reason === "string" && reason.trim()
      ? reason
      : status ? messages[status] || "The photo request failed."
        : "Cannot reach the photo upload endpoint. Check that the backend is running and the browser console has no CORS error.";
    throw new Error(`${message}${status ? ` (HTTP ${status})` : ""} Your selection is kept.`);
  }
}
