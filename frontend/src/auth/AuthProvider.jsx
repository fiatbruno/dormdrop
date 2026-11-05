
import {
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { AuthContext } from "./AuthContext";
import {
  getToken,
  subscribe,
  login,
  logout,
} from "./session";

import { verifyAdminSession } from "../api/adminAuthApi";

export default function AuthProvider({ children }) {
  const token = useSyncExternalStore(
    subscribe,
    getToken
  );

  const [adminStatus, setAdminStatus] = useState({
    token: null,
    isAdmin: false,
    checking: false,
  });

  useEffect(() => {
    let active = true;
    let requestId = 0;

    if (!token) {
      return () => {
        active = false;
      };
    }

    async function checkPrivileges() {
      const currentRequest = ++requestId;
      const authorized = await verifyAdminSession();

      if (active && currentRequest === requestId) {
        setAdminStatus({
          token,
          isAdmin: authorized,
          checking: false,
        });
      }
    }

    checkPrivileges();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void checkPrivileges();
    };
    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("online", refreshWhenVisible);

    return () => {
      active = false;
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenVisible);
    };
  }, [token]);

  const isAuthenticated = Boolean(token);

  const adminChecking =
    isAuthenticated &&
    adminStatus.token !== token;

  const isAdmin =
    isAuthenticated &&
    adminStatus.token === token &&
    adminStatus.isAdmin;

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated,
        isAdmin,
        adminChecking,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
