
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

    if (!token) {
      return () => {
        active = false;
      };
    }

    async function checkPrivileges() {
      const authorized = await verifyAdminSession();

      if (active) {
        setAdminStatus({
          token,
          isAdmin: authorized,
          checking: false,
        });
      }
    }

    checkPrivileges();

    return () => {
      active = false;
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
