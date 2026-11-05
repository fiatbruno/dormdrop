
import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import useAuth from "../hooks/useAuth";

export default function AdminProtectedRoute() {
  const location = useLocation();

  const {
    isAuthenticated,
    isAdmin,
    adminChecking,
  } = useAuth();

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{
          from: `${location.pathname}${location.search}${location.hash}`,
        }}
        replace
      />
    );
  }

  if (adminChecking) {
    return (
      <div className="admin-loading">
        Verifying administrator access...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <main className="admin-loading" role="alert">
        <h1>Access denied</h1>
        <p>
          Your account does not have administrator
          access.
        </p>
      </main>
    );
  }

  return <Outlet />;
}
