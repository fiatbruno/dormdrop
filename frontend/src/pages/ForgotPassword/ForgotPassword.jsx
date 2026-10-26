import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LockKeyhole, Mail } from "lucide-react";
import PasswordResetLayout from "../../components/PasswordResetLayout/PasswordResetLayout.jsx";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1";

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();

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
          body: JSON.stringify({ email: normalizedEmail }),
        }
      );

      if (!response.ok) {
        throw new Error("Unable to request password reset.");
      }

      navigate("/check-your-inbox", {
        state: { email: normalizedEmail },
      });
    } catch {
      setError(
        "We couldn't process your request right now. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <PasswordResetLayout authAction="signup">
      <div className="passwordResetPage__icon">
        <LockKeyhole size={23} />
      </div>

      <h2>Forgot your password?</h2>

      <p className="passwordResetPage__subtitle">
        Enter your campus email and we'll send a password-reset link.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="passwordResetPage__field">
          <label htmlFor="forgot-email">
            Campus email (.edu)
          </label>

          <div className="passwordResetPage__input">
            <Mail size={17} />

            <input
              id="forgot-email"
              type="email"
              placeholder="you@college.edu"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
        </div>

        <p className="passwordResetPage__hint">
          Use the email linked to your account.
        </p>

        {error && (
          <p className="passwordResetPage__error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="passwordResetPage__button"
          disabled={loading}
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>

      <Link to="/login" className="passwordResetPage__link">
        Back to log in
      </Link>
    </PasswordResetLayout>
  );
}