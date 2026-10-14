import { useSyncExternalStore } from "react";
import { AuthContext } from "./AuthContext";
import { getToken, subscribe, login, logout } from "./session";

export default function AuthProvider({ children }) {
  const token = useSyncExternalStore(subscribe, getToken);
  return (
    <AuthContext.Provider value={{ token, isAuthenticated: Boolean(token), login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
