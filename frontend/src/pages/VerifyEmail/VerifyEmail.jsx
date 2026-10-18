import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";

import AuthLeftPanel from "../../components/AuthLeftPanel/AuthLeftPanel";
import Footer from "../../components/Footer/Footer";

import { resendVerificationEmail } from "../../api/backendApi";

import Navbar from "../../components/Navbar/Navbar";
import "../../components/AuthLeftPanel/AuthPage.css";

import "../Signup/Signup.css";
import "./VerifyEmail.css";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();

 
  const email = location.state?.email;

  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");
  const [isResending, setIsResending] = useState(false);

async function handleResend() {
  if (!email || isResending) return;

  setResendMessage("");
  setResendError("");
  setIsResending(true);

  try {
    await resendVerificationEmail(email);

    setResendMessage(
      "If your account needs verification, a new link will be sent.",
    );
  } catch {
    setResendError("Unable to process the request. Please try again later.");
  } finally {
    setIsResending(false);
  }
}

  function handleDifferentEmail() {
    navigate("/signup");
  }

  function handleContinue() {
    navigate("/login");
  }

  return (
    <div id="signupPage" className="authPage verificationPage">
      <Navbar variant="auth" authAction="login" />

      <main className="signupMain authPage__main">
        <AuthLeftPanel />

        <div className="signupRight authPage__form">
          <div id="verifyEmailPage">
            <div className="verifyEmailContainer">

              <div className="verifyEmailIcon">
                <Mail size={21} />
              </div>

              <h1 className="signupTitle">Check your campus inbox</h1>

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
                <p className="resendSuccess" role="status">
                  {resendMessage}
                </p>
              )}

              {resendError && (
                <p className="resendError" role="alert">
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
