
import { useEffect, useState } from "react";
import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import {
  getAdminToken,
  verifyAdminSession,
} from "../api/adminAuthApi";

export default function AdminProtectedRoute() {
  const location = useLocation();

  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let active = true;

    async function checkAdmin() {
      setStatus("checking");

      if (!getAdminToken()) {
        if (active) setStatus("unauthorized");
        return;
      }

      try {
        const admin = await verifyAdminSession();

        if (active) {
          setStatus(admin ? "authorized" : "unauthorized");
        }
      } catch {
        if (active) setStatus("unauthorized");
      }
    }

    checkAdmin();

    return () => {
      active = false;
    };
  }, [location.pathname]);

  if (status === "checking") {
    return (
      <div className="admin-loading">
        Verifying administrator access...
      </div>
    );
  }

  if (status === "unauthorized") {
    return (
      <Navigate
        to="/admin/login"
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  return <Outlet />;
}
