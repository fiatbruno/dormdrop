
import "./Login.css";
import "../../components/AuthLeftPanel/AuthPage.css";

import { useState } from "react";
import useAuth from "../../hooks/useAuth";

import AuthLeftPanel from "../../components/AuthLeftPanel/AuthLeftPanel.jsx";
import Footer from "../../components/Footer/Footer.jsx";

import {
  useNavigate,
  useLocation,
  Link,
} from "react-router-dom";

import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "../../schemas/authSchemas.js";
import { loginUser } from "../../api/backendApi.js";
import Navbar from "../../components/Navbar/Navbar.jsx";

function Login() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
  });

  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const returnTo = location.state?.from;
  const requestedDestination = typeof returnTo === "string" ? returnTo : returnTo?.pathname;

  const destination =
    typeof requestedDestination === "string" &&
    requestedDestination.startsWith("/") &&
    !requestedDestination.startsWith("//") &&
    !requestedDestination.startsWith("/\\") &&
    requestedDestination !== "/login" &&
    requestedDestination !== "/admin/login"
      ? requestedDestination
      : "/home";

  const onSubmit = async (data) => {
    setError("");

    try {
      const response = await loginUser(data);

      login(response.data.token);

      navigate(destination === requestedDestination && typeof returnTo === "object"
        ? { pathname: destination, search: returnTo.search || "", hash: returnTo.hash || "" }
        : destination, {
        replace: true,
      });
    } catch {
      setError("Invalid email or password.");
    }
  };

  return (
    <div id="loginPage" className="authPage">
      <Navbar variant="auth" />

      <main className="loginMain authPage__main">
        <AuthLeftPanel />

        <div className="loginRight authPage__form">
          <h1 className="loginFormTitle">
            Welcome back
          </h1>

          <p>Your next campus find is waiting.</p>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="input">
              <label htmlFor="email">
                Campus Email (.edu)
              </label>

              <div
                className={`inputField ${
                  errors.email ? "inputError" : ""
                }`}
              >
                <Mail className="inputicon" />

                <input
                  type="text"
                  id="email"
                  placeholder="Joe@augustana.edu"
                  {...register("email")}
                  className="credentialField"
                />
              </div>

              {errors.email && (
                <p className="fieldError">
                  {errors.email.message}
                </p>
              )}

              <p className="inputHelp">
                Use the .edu email issued by your school.
              </p>
            </div>

            <div className="input">
              <label htmlFor="password">
                Password
              </label>

              <div
                className={`inputField ${
                  errors.password ? "inputError" : ""
                }`}
              >
                <Lock className="inputicon" />

                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  id="password"
                  placeholder="•••••••••••"
                  {...register("password")}
                  className="credentialField"
                />

                {showPassword ? (
                  <EyeOff
                    className="eyeIcon"
                    onClick={() =>
                      setShowPassword(false)
                    }
                  />
                ) : (
                  <Eye
                    className="eyeIcon"
                    onClick={() =>
                      setShowPassword(true)
                    }
                  />
                )}
              </div>

              {errors.password && (
                <p className="fieldError">
                  {errors.password.message}
                </p>
              )}

              <div className="forgotPassword">
                <Link to="/forgot-password">
                  Forgot password?
                </Link>
              </div>
            </div>

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Logging in..."
                : "Log In"}
            </button>
          </form>

          <div className="createAccount">
            <p>
              New to DormDrop?{" "}
              <Link to="/signup">
                Create an account
              </Link>
            </p>
          </div>

          <div className="campusInfoBox">
            <ShieldCheck className="campusInfoIcon" />

            <div className="campusInfoText">
              <h3>Made for your campus</h3>

              <p>
                A verified .edu email is required to use
                DormDrop.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default Login;
