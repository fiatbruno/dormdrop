
import { useState } from "react";
import { Link } from "react-router-dom";
import { LockKeyhole, Mail, ShieldCheck, ArrowLeft } from "lucide-react";
import "./ForgotPassword.css";

import AuthLeftPanel from "../../components/AuthLeftPanel/AuthLeftPanel.jsx";
import "../../components/AuthLeftPanel/AuthPage.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess(false);

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Please enter your campus email address.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.edu$/i.test(normalizedEmail)) {
      setError("Please enter a valid .edu email address.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: normalizedEmail,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Unable to process password reset request.");
      }

      setSuccess(true);
    } catch (err) {
      setError(
        "We couldn't send your reset link right now. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="forgot-page">
      {/* Header */}
      <header className="forgot-header">
        <Link to="/" className="forgot-logo">
          DormDrop <span>🎒</span>
        </Link>

        <div className="forgot-header-actions">
          <Link to="/" className="forgot-marketplace-link">
            <ArrowLeft size={15} />
            Back to marketplace
          </Link>

          <Link to="/signup" className="forgot-signup-button">
            Sign up
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="forgot-main authPage__main">
        <AuthLeftPanel />

        {/* Right form panel */}
        <section className="forgot-form-section authPage__form">
          <div className="forgot-form-container">
            <div className="forgot-lock-icon">
              <LockKeyhole size={23} strokeWidth={1.7} />
            </div>

            {!success ? (
              <>
                <h2>Forgot your password?</h2>

                <p className="forgot-subtitle">
                  Enter your campus email and we'll send
                  a password-reset link.
                </p>

                <form onSubmit={handleSubmit}>
                  <div className="forgot-field">
                    <label htmlFor="forgot-email">
                      Campus email (.edu)
                    </label>

                    <div className="forgot-input-wrapper">
                      <Mail size={17} />

                      <input
                        id="forgot-email"
                        type="email"
                        placeholder="you@college.edu"
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value);
                          setError("");
                        }}
                        autoComplete="email"
                        required
                      />
                    </div>

                    <small>
                      Use the email linked to your account.
                    </small>
                  </div>

                  {error && (
                    <p className="forgot-error" role="alert">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="forgot-submit-button"
                    disabled={loading}
                  >
                    {loading
                      ? "Sending..."
                      : "Send reset link"}
                  </button>
                </form>
              </>
            ) : (
              <div className="forgot-success">
                <h2>Check your email</h2>

                <p>
                  If an account exists for{" "}
                  <strong>{email.trim()}</strong>,
                  you'll receive a password-reset link.
                </p>

                <button
                  type="button"
                  className="forgot-submit-button"
                  onClick={() => {
                    setSuccess(false);
                    setError("");
                  }}
                >
                  Try another email
                </button>
              </div>
            )}

            <Link to="/login" className="forgot-login-link">
              Back to log in
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="forgot-footer">
        <span>© 2026 DormDrop</span>
        <span>Built for your campus community.</span>
      </footer>
    </div>
  );
}
