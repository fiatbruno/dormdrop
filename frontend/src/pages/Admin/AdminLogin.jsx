
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";

import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import Button from "../../components/Button/Button";
import { adminLogin } from "../../api/adminAuthApi";

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

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (!normalizedEmail.endsWith("@augustana.edu")) {
      setError("Please enter your Augustana email address.");
      return;
    }

    setLoading(true);

    try {
      await adminLogin(normalizedEmail, password);

      const destination =
        typeof redirectTo === "string" &&
        redirectTo.startsWith("/admin/") &&
        !redirectTo.startsWith("//") &&
        redirectTo !== "/admin/login"
          ? redirectTo
          : "/admin/users";

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
      <Navbar variant="auth" authAction="login" />

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

                <Button
                  type="button"
                  className="admin-password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              className="admin-login-submit"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in to admin"}
              {!loading && <ArrowRight size={18} />}
            </Button>
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

      <Footer />
    </div>
  );
}
