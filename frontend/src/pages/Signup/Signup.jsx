import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User, Mail, Lock, Eye, EyeOff } from "lucide-react";

import { signupSchema } from "../../schemas/authSchemas";
import { registerUser } from "../../api/backendApi";

import AuthLeftPanel from "../../components/AuthLeftPanel/AuthLeftPanel";
import Footer from "../../components/Footer/Footer";
import Button from "../../components/Button/Button";

import logo from "../../assets/Logo.png";

import "./Signup.css";

export default function Signup() {
  const [serverError, setServerError] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(signupSchema),
    mode: "onBlur",
  });

  async function onSubmit(data) {
    setServerError("");

    try {
      await registerUser({
        name: data.displayName,
        studentEmail: data.email,
        password: data.password,
      });

      navigate("/verify-email", {
        state: { email: data.email },
      });
    } catch (error) {
      const status = error.response?.status;
      const backendMessage = error.response?.data;

      const message =
        typeof backendMessage === "string"
          ? backendMessage
          : backendMessage?.detail || backendMessage?.message || "";

      if (
        status === 409 ||
        /already exists|already registered|already in use|already associated/i.test(
          message,
        )
      ) {
        setServerError(
          "An account with this email already exists. Please log in or use a different email address.",
        );
      } else {
        setServerError(
          message || "Unable to create your account. Please try again.",
        );
      }
    }
  }
  return (
    <div id="signupPage">
      <header className="signupHeader">
        <img className="logo" src={logo} alt="DormDrop Logo" />

        <Button className="loginButton" onClick={() => navigate("/login")}>
          Log In
        </Button>
      </header>

      <main className="signupMain">
        <AuthLeftPanel />

        <div className="signupRight">
          <h1 className="signupTitle">Create your account</h1>

          <p className="signupSubtitle">
            Join your verified campus marketplace.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="input">
              <label htmlFor="displayName">Display name</label>

              <div
                className={`inputField ${
                  errors.displayName ? "inputError" : ""
                }`}
              >
                <User className="inputicon" />

                <input
                  id="displayName"
                  type="text"
                  placeholder="Alex Morgan"
                  {...register("displayName")}
                  className="credentialField"
                />
              </div>

              {errors.displayName && (
                <p className="fieldError">{errors.displayName.message}</p>
              )}
            </div>

            <div className="input">
              <label htmlFor="email">Campus Email (.edu)</label>

              <div className={`inputField ${errors.email ? "inputError" : ""}`}>
                <Mail className="inputicon" />

                <input
                  id="email"
                  type="email"
                  placeholder="you@college.edu"
                  {...register("email")}
                  className="credentialField"
                />
              </div>

              {errors.email && (
                <p className="fieldError">{errors.email.message}</p>
              )}

              <p className="inputHelp">
                Use your school-issued .edu email address.
              </p>
            </div>

            <div className="input">
              <label htmlFor="password">Password</label>

              <div
                className={`inputField ${errors.password ? "inputError" : ""}`}
              >
                <Lock className="inputicon" />

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  {...register("password")}
                  className="credentialField"
                />

                {showPassword ? (
                  <EyeOff
                    className="eyeIcon"
                    onClick={() => setShowPassword(false)}
                  />
                ) : (
                  <Eye
                    className="eyeIcon"
                    onClick={() => setShowPassword(true)}
                  />
                )}
              </div>

              {errors.password && (
                <p className="fieldError">{errors.password.message}</p>
              )}

              <p className="inputHelp">Use at least 8 characters.</p>
            </div>

            <div className="input">
              <label htmlFor="confirmPassword">Confirm password</label>

              <div
                className={`inputField ${
                  errors.confirmPassword ? "inputError" : ""
                }`}
              >
                <Lock className="inputicon" />

                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  {...register("confirmPassword")}
                  className="credentialField"
                />

                {showConfirmPassword ? (
                  <EyeOff
                    className="eyeIcon"
                    onClick={() => setShowConfirmPassword(false)}
                  />
                ) : (
                  <Eye
                    className="eyeIcon"
                    onClick={() => setShowConfirmPassword(true)}
                  />
                )}
              </div>

              {errors.confirmPassword && (
                <p className="fieldError">{errors.confirmPassword.message}</p>
              )}
            </div>

            {serverError && (
              <p className="serverError" role="alert">
                {serverError}
              </p>
            )}

            <button type="submit" className="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>
          </form>

          <div className="loginAccount">
            <p>
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
