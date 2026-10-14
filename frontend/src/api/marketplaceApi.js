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

  const imageUrl = listing.imageUrl;
  const backendUrl = new URL(api.defaults.baseURL, window.location.origin);

  return {
    ...listing,
    id,
    price,
    image: imageUrl
      ? imageUrl.startsWith("http")
        ? imageUrl
        : new URL(imageUrl, backendUrl).href
      : "",
    pickupLocation: listing.pickupArea,
    listedOn: listing.listedOn
      ? listing.listedOn.slice(0, 10)
      : "",
    listingType: listing.listingType || "For sale"
  };
}

export async function getListings() {
  const { data: listings } = await api.get("/home");
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
