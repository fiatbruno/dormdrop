import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";

import AuthLeftPanel from "../../components/AuthLeftPanel/AuthLeftPanel";
import Footer from "../../components/Footer/Footer";
import Button from "../../components/Button/Button";

// Uncomment when backend resend endpoint is ready
// import { resendVerificationEmail } from "../../api/backendApi";

import logo from "../../assets/Logo.png";

import "../Signup/Signup.css";
import "./VerifyEmail.css";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();

 
  const email = location.state?.email;

  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");
  const [isResending, setIsResending] = useState(false);

  /*
   * BACKEND VERSION: * Replace the temporary handleResend below with this when
   * the resend-verification endpoint is ready.
   *
   * async function handleResend() {
   *   setResendMessage("");
   *   setResendError("");
   *   setIsResending(true);
   *
   *   try {
   *     await resendVerificationEmail(email);
   *     setResendMessage("Verification email resent successfully.");
   *   } catch (error) {
   *     setResendError(
   *       error.response?.data?.message ||
   *       "Unable to resend verification email."
   *     );
   *   } finally {
   *     setIsResending(false);
   *   }
   * }
   */

  // TEMPORARY FRONTEND VERSION
  function handleResend() {
    console.log("Resend verification email to:", email);

    setResendMessage(
      "Resend button works. Backend is not connected yet."
    );
  }

  function handleDifferentEmail() {
    navigate("/signup");
  }

  function handleContinue() {
    navigate("/login");
  }

  return (
    <div id="signupPage">
      <header className="signupHeader">
        <img className="logo" src={logo} alt="DormDrop Logo" />

        <Button
          className="loginButton"
          onClick={() => navigate("/login")}
        >
          Log In
        </Button>
      </header>

      <main className="signupMain">
        <AuthLeftPanel />

        <div className="signupRight">
          <div id="verifyEmailPage">
            <div className="verifyEmailContainer">

              <div className="verifyEmailIcon">
                <Mail size={21} />
              </div>

              <h1>Check your campus inbox</h1>

              <p className="verifySubtitle">
                Verify your email to unlock your campus marketplace.
              </p>

              <div className="verificationEmailBox">
                <p className="verificationLabel">
                  Verification link sent to
                </p>

                <p className="verificationAddress">
                  {email || "your campus email"}
                </p>
              </div>

              <p className="verificationInstructions">
                Open the link in your email to activate your account.
                <br />
                Check your spam folder if you don't see it.
              </p>

              <button
                className="resendVerificationButton"
                onClick={handleResend}
                disabled={isResending || !email}
              >
                {isResending
                  ? "Sending..."
                  : "Resend verification email"}
              </button>

              {resendMessage && (
                <p className="resendSuccess">
                  {resendMessage}
                </p>
              )}

              {resendError && (
                <p className="resendError">
                  {resendError}
                </p>
              )}

              <button
                className="verifyTextButton"
                onClick={handleDifferentEmail}
              >
                Use a different email
              </button>

              <button
                className="verifyTextButton"
                onClick={handleContinue}
              >
                Already verified? Continue
              </button>

            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}