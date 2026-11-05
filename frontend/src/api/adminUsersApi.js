
import api from "./client";

export async function getAdminUsers({
  search = "",
  page = 0,
  size = 20,
} = {}) {
  const response = await api.get("/admin/users", {
    params: {
      ...(search.trim() ? { search: search.trim() } : {}),
      page,
      size,
    },
  });

  const data = response.data;

  if (
    !data ||
    !Array.isArray(data.items) ||
    !Number.isInteger(data.page)
  ) {
    throw new Error("Invalid admin directory response.");
  }

  return data;
}

const unsupported = () => {
  throw new Error(
    "This admin feature is not available in the current backend."
  );
};

export const getAdminUserDetails = unsupported;
export const getAdminUserListings = unsupported;
export const getModerationHistory = unsupported;
export const getAdminNotes = unsupported;
export const addAdminNote = unsupported;
export const sendPolicyWarning = unsupported;
export const suspendAdminUser = unsupported;
export const getAdminListingDetails = unsupported;
