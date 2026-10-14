// Client-side expiry checks improve navigation; the backend verifies JWT signatures.
export function tokenExpiresAt(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || parts.some(part => !part)) return 0;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && Number.isFinite(payload.exp)
      ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

const listeners = new Set();
let currentToken = null;
let expirationTimer;
const notify = () => listeners.forEach(listener => listener());

function syncSession() {
  clearTimeout(expirationTimer);
  const stored = localStorage.getItem("token");
  const remaining = tokenExpiresAt(stored) - Date.now();
  const next = remaining > 0 ? stored : null;
  if (!next) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  } else {
    expirationTimer = setTimeout(syncSession, Math.min(remaining, 2147483647));
  }
  if (currentToken !== next) {
    currentToken = next;
    notify();
  }
}

syncSession();
window.addEventListener("storage", event => {
  if (event.key === "token" || event.key === null) syncSession();
});
window.addEventListener("focus", syncSession);

export const subscribe = listener => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getToken = () => currentToken;
export function login(token) {
  if (tokenExpiresAt(token) <= Date.now()) throw new Error("Invalid or expired session");
  localStorage.setItem("token", token);
  syncSession();
}
export function logout(expectedToken) {
  // An old request must not log out a newer login, including one in another tab.
  if (expectedToken && localStorage.getItem("token") !== expectedToken) return;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  syncSession();
}
