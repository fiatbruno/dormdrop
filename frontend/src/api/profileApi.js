
import api from "./client";

// Profile, password-reset, and logout routes still need backend implementation.
const endpoints = {
  profile: "/users/me",
  myListings: "/users/me/listings",
  listingStatus: (id) => `/home/${encodeURIComponent(id)}/status`,
  resetPassword: "/auth/forgot-password",
  logout: "/auth/logout",
};

// Get logged-in user's profile
export async function getProfile() {
  const { data } = await api.get(endpoints.profile);
  return data;
}

// Update display name and bio
export async function saveProfile(profile) {
  const { data, status } = await api.put(endpoints.profile, profile);
  return status === 204 ? null : data;
}

// Get the logged-in user's listings
export async function getMyListings() {
  const { data } = await api.get(endpoints.myListings);
  return data;
}

// Mark an item as sold or available
export async function updateListingStatus(id, status) {
  const { data } = await api.patch(endpoints.listingStatus(id), null, {
    params: { status },
  });
  return data;
}

// Request a password reset
export async function resetPassword(email) {
  const { data, status } = await api.post(endpoints.resetPassword, { email });
  return status === 204 ? null : data;
}

// Log out
export async function logout() {
  const { data, status } = await api.post(endpoints.logout);
  return status === 204 ? null : data;
}
