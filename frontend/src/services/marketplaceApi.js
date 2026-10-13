
const API_BASE =
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080/api/v1";

function getToken() {
  return localStorage.getItem("token");
}

async function request(path, options = {}) {
  const token = getToken();

  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...options.headers
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    `${API_BASE}${path}`,
    { ...options, headers }
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

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

  return {
    ...listing,
    id,
    price,
    image: imageUrl
      ? imageUrl.startsWith("http")
        ? imageUrl
        : `${new URL(API_BASE).origin}${imageUrl}`
      : "",
    pickupLocation: listing.pickupArea,
    listedOn: listing.listedOn
      ? listing.listedOn.slice(0, 10)
      : "",
    listingType: listing.listingType || "For sale"
  };
}

export async function getListings() {
  const listings = await request("/home");
  return listings.map(normalizeListing);
}

export async function getFavorites() {
  return request("/favorites");
}

export async function addFavorite(id) {
  return request(`/favorites/${id}`, {
    method: "POST"
  });
}

export async function removeFavorite(id) {
  return request(`/favorites/${id}`, {
    method: "DELETE"
  });
}

export async function createListing(listing) {
  return request("/home", {
    method: "POST",
    body: JSON.stringify({
      title: listing.title,
      description: listing.description,
      category: listing.category,
      price: Number(listing.price),
      condition: listing.condition,
      pickupArea:
        listing.pickupArea || listing.pickupLocation,
      listingType: listing.listingType || "For sale"
    })
  });
}

export async function uploadListingImage(id, file) {
  const formData = new FormData();
  formData.append("file", file);

  return request(`/images/${id}`, {
    method: "POST",
    body: formData
  });

  export async function getListingById(id) {
    const listing = await request(
      `/home/${encodeURIComponent(id)}`
    );

    return normalizeListing(listing);
  }

  export async function updateListing(id, listing) {
    return request(`/home/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({
        title: listing.title,
        description: listing.description,
        category: listing.category,
        price: Number(listing.price),
        condition: listing.condition,
        pickupArea: listing.pickupLocation,
        listingType: listing.listingType,
      }),
    });
  }
}
