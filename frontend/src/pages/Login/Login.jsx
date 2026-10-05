import React, { useState } from "react";
import "./Login.css";
import Button from "../../components/Button/Button.jsx";
import AuthLeftPanel from "../../components/AuthLeftPanel/AuthLeftPanel.jsx";
import Footer from "../../components/Footer/Footer.jsx";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "../../schemas/authSchemas.js";
import logo from "../../assets/Logo.png";
import { loginUser } from "../../api/backendApi.js";

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
  const [showPassword, setShowPassword] = useState(false);

  // This is a function that gets called whenever the email or password
  // text field is updated by the user.

  // This is a function that gets called when the login button is clicked.
  const onSubmit = async (data) => {
    try {
      // Make a POST request to the backend with the user's credentials.

    const response = await loginUser(data);
    localStorage.setItem("token", response.data.token);

      navigate("/home");

    } catch (err) {
      // On failure, set an error message.
      setError("Invalid email or password.");
    }
  };

  // We are now ready to construct and return the login page HTML.
  return (
    <div id="loginPage">
      <header className="loginHeader">
        <div className="headerLeft">
          <img className="logo" src={logo} alt="DormDrop Logo" />
        </div>

        <div className="headerRight">
          <Button className="signupButton" onClick={() => navigate("/signup")}>
            Sign Up
          </Button>
        </div>
      </header>

      <main className="loginMain">
        <AuthLeftPanel />

        <div className="loginRight">
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
            {error && <p className="error">{error}</p>}
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
