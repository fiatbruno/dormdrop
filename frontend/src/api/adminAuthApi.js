
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
    await api.get("/admin/users", {
      params: {
        page: 0,
        size: 1,
      },
    });

    return true;
  } catch {
    return false;
  }
}

export function adminLogout() {
  logout();
}
