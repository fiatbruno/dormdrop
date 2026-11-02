import { useState } from "react";
import { Link } from "react-router-dom";
import { CircleAlert, Mail } from "lucide-react";
import PasswordResetLayout from "../../components/PasswordResetLayout/PasswordResetLayout.jsx";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1";

export default function PasswordResetExpired() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      if (!response.ok) {
        throw new Error("Unable to request a new password-reset link.");
      }

      setMessage(
        "If a verified account exists, a new password-reset link will be sent.",
      );
    } catch {
      setError("Unable to send a new link. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PasswordResetLayout>
      <div className="passwordResetPage__icon">
        <CircleAlert size={23} />
      </div>

      <h2>Password reset link expired</h2>

      <p className="passwordResetPage__subtitle">
        Password-reset links expire after 5 minutes. Enter your campus email to
        request a new link.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="passwordResetPage__field">
          <label htmlFor="expired-reset-email">Campus email</label>

          <div className="passwordResetPage__input">
            <Mail size={17} />
            <input
              id="expired-reset-email"
              type="email"
              placeholder="you@college.edu"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
        </div>

        {error && (
          <p className="passwordResetPage__error" role="alert">
            {error}
          </p>
        )}

        {message && (
          <p className="passwordResetPage__notice" role="status">
            {message}
          </p>
        )}

        <button
          type="submit"
          className="passwordResetPage__button"
          disabled={loading || !email.trim()}
        >
          {loading ? "Sending..." : "Send a new password reset link"}
        </button>
      </form>

      <Link to="/login" className="passwordResetPage__link">
        Back to log in
      </Link>
    </PasswordResetLayout>
  );
}
