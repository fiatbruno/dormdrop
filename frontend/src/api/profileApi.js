
const API_URL = "/api";

// Change these paths to match the Spring Boot controllers.
const endpoints = {
  profile: "/users/me",
  myListings: "/users/me/listings",
  listingStatus: (id) => `/listings/${id}/status`,
  resetPassword: "/auth/forgot-password",
  logout: "/auth/logout",
};

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  if (response.status === 204) return null;

  return response.json();
}

// Get logged-in user's profile
export function getProfile() {
  return request(endpoints.profile);
}

// Update display name and bio
export function saveProfile(data) {
  return request(endpoints.profile, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// Get the logged-in user's listings
export function getMyListings() {
  return request(endpoints.myListings);
}

// Mark an item as sold or available
export function updateListingStatus(id, status) {
  return request(endpoints.listingStatus(id), {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// Request a password reset
export function resetPassword(email) {
  return request(endpoints.resetPassword, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

// Log out
export function logout() {
  return request(endpoints.logout, {
    method: "POST",
  });
}
