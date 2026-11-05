
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
    return data?.role === "ADMIN";
  } catch {
    return false;
  }
}

export function adminLogout() {
  logout();
}
