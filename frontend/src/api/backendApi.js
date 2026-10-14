import api from "./client";

export function registerUser(user) {
  return api.post("/auth/register", user);
}

export function loginUser(credentials) {
  return api.post("/auth/login", credentials);
}
export function resendVerificationEmail(email) {
  return api.post("/auth/resend-verification", {
    email,
  });
}

export default api;
