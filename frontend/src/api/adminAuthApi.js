
import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const ADMIN_TOKEN_KEY = "dormdrop_admin_token";
const ADMIN_USER_KEY = "dormdrop_admin_user";

const adminClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

adminClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export async function adminLogin(email, password) {
  // Expected backend endpoint.
  const response = await adminClient.post("/auth/admin/login", {
    email: email.trim().toLowerCase(),
    password,
  });

  const { token, user } = response.data;

  if (!token || !user || user.role !== "ADMIN") {
    throw new Error("This account does not have administrator access.");
  }

  // Save only after confirming the response is shaped correctly.
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  sessionStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));

  return user;
}

export async function verifyAdminSession() {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);

  if (!token) {
    return null;
  }

  try {
    // This endpoint must verify the JWT and ROLE_ADMIN server-side.
    const response = await adminClient.get("/auth/admin/me");

    if (response.data.role !== "ADMIN") {
      adminLogout();
      return null;
    }

    sessionStorage.setItem(
      ADMIN_USER_KEY,
      JSON.stringify(response.data)
    );

    return response.data;
  } catch {
    adminLogout();
    return null;
  }
}

export function getAdminUser() {
  try {
    const stored = sessionStorage.getItem(ADMIN_USER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function getAdminToken() {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

export function adminLogout() {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_USER_KEY);
}

export { adminClient };
