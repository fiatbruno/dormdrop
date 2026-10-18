import "./Login.css";
import "../../components/AuthLeftPanel/AuthPage.css";


import { useState } from "react";
import useAuth from "../../hooks/useAuth";


import AuthLeftPanel from "../../components/AuthLeftPanel/AuthLeftPanel.jsx";
import Footer from "../../components/Footer/Footer.jsx";

import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "../../schemas/authSchemas.js";
import { loginUser } from "../../api/backendApi.js";
import Navbar from "../../components/Navbar/Navbar.jsx";

/*
 * A simple login page to help you get started with authenticating
 * users.
 */
function Login() {
  // This component needs to track state, namely the user's credentials
  // and a possible error message.
  //
  // To declare UI state in react, call the `useState` function. This
  // function takes as input the initial state, and outputs both an
  // object with that state and setter. For example, saying:
  //
  //   [isCold, setCold] = useState(true)
  //
  // gives us a state `isCold` and a function `setCold`. The value of
  // `isCold` is initially `true`, but will change if `setCold` is
  // called. Crucially, whenever `setCold` is called, any UI
  // componenent that depends on the value of `isCold` will
  // automatically be re-rendered.
  //
  // Here we set up state for user credentials and an error message:
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema), mode: "onBlur" });

  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  // This is a function that gets called whenever the email or password
  // text field is updated by the user.

  // This is a function that gets called when the login button is clicked.
  const onSubmit = async (data) => {
    try {
      // Make a POST request to the backend with the user's credentials.

    const response = await loginUser(data);
    login(response.data.token);

      navigate("/home", { replace: true });

    } catch {
      // On failure, set an error message.
      setError("Invalid email or password.");
    }
  };

  // We are now ready to construct and return the login page HTML.
  return (
    <div id="loginPage" className="authPage">
      <Navbar variant="auth" />

      <main className="loginMain authPage__main">
        <AuthLeftPanel />

        <div className="loginRight authPage__form">
          <h1 className="loginFormTitle">Welcome back</h1>

          <p>Your next campus find is waiting.</p>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="input">
              <label htmlFor="email">Campus Email (.edu)</label>
              <div className={`inputField ${errors.email ? "inputError" : ""}`}>
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
                <p className="fieldError">{errors.email.message}</p>
              )}
              <p className="inputHelp">
                Use the .edu email issued by your school.
              </p>
            </div>

            <div className="input">
              <label htmlFor="password">Password</label>

              <div
                className={`inputField ${errors.password ? "inputError" : ""}`}
              >
                <Lock className="inputicon" />

                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  placeholder="•••••••••••"
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
                    onClick={() => setShowPassword(!showPassword)}
                  />
                )}
              </div>
              {errors.password && (
                <p className="fieldError">{errors.password.message}</p>
              )}

              <div className="forgotPassword">
                <Link to="/login/forgotpassword">Forgot password?</Link>
              </div>
            </div>
            {error && <p className="error" role="alert">{error}</p>}
            <button type="submit" className="submit" disabled={isSubmitting}>
              {isSubmitting ? "Logging in..." : "Log In"}
            </button>
          </form>
          <div className="createAccount">
            <p>
              New to DormDrop? <Link to="/signup">Create an account</Link>
            </p>
          </div>

          <div className="campusInfoBox">
            <ShieldCheck className="campusInfoIcon" />
            <div className="campusInfoText">
              <h3>Made for your campus</h3>
              <p>A verified .edu email is required to use DormDrop.</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default Login;
