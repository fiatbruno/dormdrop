
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import {
  adminLogin
} from "../../api/adminAuthApi";
import "./AdminLogin.css";

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const redirectTo = location.state?.from;

  // The protected route will verify any existing token.


  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (!email.trim().toLowerCase().endsWith("@augustana.edu")) {
      setError("Please enter your Augustana email address.");
      return;
    }

    setLoading(true);

    try {
      await adminLogin(email, password);

      const destination =
        typeof redirectTo === "string" &&
        redirectTo.startsWith("/admin/") &&
        !redirectTo.startsWith("//") &&
        redirectTo !== "/admin/login"
          ? redirectTo
          : "/admin/users/USR-0087";

      navigate(destination, { replace: true });
    } catch (err) {
      const status = err.response?.status;

      if (status === 401) {
        setError("Invalid email or password.");
      } else if (status === 403) {
        setError("You do not have administrator access.");
      } else {
        setError(
          err.response?.data?.message ||
            err.message ||
            "Unable to sign in. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-page">
      <header className="admin-login-header">
        <Link to="/" className="admin-login-logo">
          DormDrop
        </Link>

        <Link to="/" className="admin-marketplace-link">
          <ArrowLeft size={16} />
          Back to marketplace
        </Link>
      </header>

      <main className="admin-login-main">
        <section className="admin-login-card">
          <div className="admin-login-icon">
            <ShieldCheck size={30} strokeWidth={1.8} />
          </div>

          <div className="admin-login-heading">
            <span>ADMINISTRATION PORTAL</span>
            <h1>Welcome back</h1>
            <p>
              Sign in with your authorized administrator
              credentials to manage the DormDrop marketplace.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="admin-login-error" role="alert">
                {error}
              </div>
            )}

            <div className="admin-form-group">
              <label htmlFor="admin-email">
                Administrator email
              </label>

              <div className="admin-input-wrapper">
                <Mail size={18} />
                <input
                  id="admin-email"
                  type="email"
                  placeholder="admin@augustana.edu"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="admin-form-group">
              <label htmlFor="admin-password">
                Password
              </label>

              <div className="admin-input-wrapper">
                <LockKeyhole size={18} />

                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={loading}
                  required
                />

                <button
                  type="button"
                  className="admin-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="admin-login-submit"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in to admin"}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="admin-login-notice">
            <ShieldCheck size={17} />
            <p>
              Restricted access. This portal is intended for
              authorized DormDrop administrators only.
            </p>
          </div>
        </section>
      </main>

      <footer className="admin-login-footer">
        <span>© 2026 DormDrop</span>
        <span>Augustana College · Administration</span>
      </footer>
    </div>
  );
}
