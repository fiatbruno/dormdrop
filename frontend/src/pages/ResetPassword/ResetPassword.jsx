import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import PasswordResetLayout from "../../components/PasswordResetLayout/PasswordResetLayout.jsx";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("This reset link is missing a token.");
      return;
    }

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    if (new TextEncoder().encode(password).length > 72) {
      setError("Your password must be at most 72 UTF-8 bytes long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token,
            newPassword: password,
            confirmPassword,
          }),
        }
      );

      const result = await response.json();

      if (
        !response.ok &&
        result.message === "Invalid or expired password reset link."
      ) {
        navigate("/password-reset-expired", { replace: true });
        return;
      }

      if (!response.ok) {
        if (response.status === 400 && result.message) {
          setError(result.message);
          return;
        }
        throw new Error("Password reset failed.");
      }

      navigate("/password-updated", {
        replace: true,
        state: { resetSuccessful: true },
      });
    } catch {
      setError("Unable to reset your password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PasswordResetLayout>
      <div className="passwordResetPage__icon">
        <LockKeyhole size={23} />
      </div>

      <h2>
        Choose a new
        <br />
        password
      </h2>

      <p className="passwordResetPage__subtitle">
        Make it memorable for you and hard for someone else to guess.
      </p>

      {!token ? (
        <>
          <p className="passwordResetPage__error" role="alert">
            This password-reset link is invalid or incomplete.
          </p>

          <Link
            to="/password-reset-expired"
            className="passwordResetPage__button"
          >
            Request a new link
          </Link>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="passwordResetPage__field">
            <label htmlFor="new-password">
              New password
            </label>

            <div className="passwordResetPage__input">
              <LockKeyhole size={16} />

              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
              />

              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <p className="passwordResetPage__hint">
            Use at least 8 characters.
          </p>

          <div className="passwordResetPage__field">
            <label htmlFor="confirm-password">
              Confirm new password
            </label>

            <div className="passwordResetPage__input">
              <LockKeyhole size={16} />

              <input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                autoComplete="new-password"
                required
              />

              <button
                type="button"
                aria-label={
                  showConfirmPassword
                    ? "Hide confirmation password"
                    : "Show confirmation password"
                }
                onClick={() =>
                  setShowConfirmPassword(!showConfirmPassword)
                }
              >
                {showConfirmPassword ? (
                  <EyeOff size={17} />
                ) : (
                  <Eye size={17} />
                )}
              </button>
            </div>
          </div>

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
            {loading ? "Resetting..." : "Reset password"}
          </button>
        </form>
      )}

      <Link to="/login" className="passwordResetPage__link">
        Back to log in
      </Link>
    </PasswordResetLayout>
  );
}
