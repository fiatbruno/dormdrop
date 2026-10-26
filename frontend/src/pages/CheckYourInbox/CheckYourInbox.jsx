import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Mail } from "lucide-react";
import PasswordResetLayout from "../../components/PasswordResetLayout/PasswordResetLayout.jsx";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1";

export default function CheckYourInbox() {
  const location = useLocation();
  const email = location.state?.email;

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleResend() {
    if (!email || loading) return;

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        }
      );

      if (!response.ok) {
        throw new Error("Resend failed.");
      }

      setMessage("If an account exists, a reset link will be sent.");
    } catch {
      setError("Unable to resend the link. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PasswordResetLayout>
      <div className="passwordResetPage__icon">
        <Mail size={23} />
      </div>

      <h2>Check your inbox</h2>

      <p className="passwordResetPage__subtitle">
        If an account uses this email, we've sent a password-reset link.
      </p>

      <div className="passwordResetPage__emailCard">
        <strong>{email || "Your campus email"}</strong>

        <p>
          Open the link in your email to choose a new password.
          Check spam if needed.
        </p>
      </div>

      {message && (
        <p className="passwordResetPage__notice" role="status">
          {message}
        </p>
      )}

      {error && (
        <p className="passwordResetPage__error" role="alert">
          {error}
        </p>
      )}

      <Link to="/login" className="passwordResetPage__button">
        Back to log in
      </Link>

      <button
        type="button"
        className="passwordResetPage__button passwordResetPage__button--outline"
        onClick={handleResend}
        disabled={loading || !email}
      >
        {loading ? "Resending..." : "Resend reset link"}
      </button>

      <Link
        to="/forgot-password"
        className="passwordResetPage__link"
      >
        Try a different email
      </Link>
    </PasswordResetLayout>
  );
}