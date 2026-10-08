
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CircleAlert } from "lucide-react";

import { resendVerificationEmail } from "../../api/backendApi";

import AuthLeftPanel from "../../components/AuthLeftPanel/AuthLeftPanel";
import Footer from "../../components/Footer/Footer";
import Button from "../../components/Button/Button";

import logo from "../../assets/Logo.png";

import "../Signup/Signup.css";
import "../VerifyEmail/VerifyEmail.css";
import "./EmailVerificationExpired.css";

export default function EmailVerificationExpired() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");


  const token = searchParams.get("token");

  function handleLogin() {
    navigate("/login");
  }

  async function handleResend() {
    if (!token || isSending) return;

    setIsSending(true);
    setError("");

    try {
      const response = await resendVerificationEmail(token);

  
      const email = response.data.email;

      navigate("/verify-email", {
        state: { email },
      });
    } catch (error) {
      setError("Unable to resend verification link. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div id="signupPage">
      
      <header className="signupHeader">
        <img
          className="logo"
          src={logo}
          alt="DormDrop Logo"
        />

        <Button
          className="loginButton"
          onClick={handleLogin}
        >
          Log In
        </Button>
      </header>

 
      <main className="signupMain">
        <AuthLeftPanel />

        <div className="signupRight">
          <div className="verificationExpiredContent">


            <div className="verificationExpiredIcon">
              <CircleAlert size={20} />
            </div>

            
            <h1 className="signupTitle">
              The link has expired
            </h1>

            <p className="signupSubtitle">
              Email verification links expire after 24 hours
              to protect your account. Request a new
              verification link to try again.
            </p>

          
            {error && (
              <p className="serverError" role="alert">
                {error}
              </p>
            )}

          
            <div className="verificationExpiredButtons">
              <Button
                className="signupSubmitButton"
                onClick={handleResend}
                disabled={isSending || !token}
              >
                {isSending
                  ? "Sending..."
                  : "Request a New Verification Link"}
              </Button>

              <Button
                className="secondaryButton"
                onClick={handleLogin}
              >
                Back to Log In
              </Button>
            </div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
