
import api from "./client";
import {
  getToken,
  logout,
} from "../auth/session";

export const adminClient = api;
export const getAdminToken = getToken;

export async function verifyAdminSession() {
  if (!getToken()) {
    return false;
  }

  try {
    const { data } = await api.get("/users/me");
    return Array.isArray(data?.capabilities) &&
      data.capabilities.includes("VIEW_MEMBER_DIRECTORY");
  } catch {
    return false;
  }
}

export function adminLogout() {
  logout();
}
