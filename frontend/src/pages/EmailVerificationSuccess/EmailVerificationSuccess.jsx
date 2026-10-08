import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

import AuthLeftPanel from "../../components/AuthLeftPanel/AuthLeftPanel";
import Footer from "../../components/Footer/Footer";
import Button from "../../components/Button/Button";

import logo from "../../assets/Logo.png";

import "../Signup/Signup.css";
import "../VerifyEmail/VerifyEmail.css";
import "./EmailVerificationSuccess.css";

export default function EmailVerificationSuccess() {
  const navigate = useNavigate();

  function handleLogin() {
    navigate("/login");
  }

//   function handleCompleteProfile() {
//     navigate("/complete-profile");
//   }

  return (
    <div id="signupPage">
      <header className="signupHeader">
        <img className="logo" src={logo} alt="DormDrop Logo" />

        <Button className="loginButton" onClick={handleLogin}>
          Log In
        </Button>
      </header>

      <main className="signupMain">
        <AuthLeftPanel />

        <div className="signupRight">
          <div className="verificationSuccessContent">
            <div className="verificationSuccessIcon">
              <CheckCircle2 size={20} />
            </div>

            <span className="verificationSuccessBadge">
              Campus email verified
            </span>

            <h1 className="signupTitle">You're part of the campus</h1>

            <p className="signupSubtitle">
              Your email is verified. You’re ready to browse, message, and list
              on DormDrop.
            </p>

            <div className="verificationCollegeBox">
              <h3>Augustana College</h3>
              <p>Campus email verified</p>
            </div>

            <div className="verificationSuccessButtons">
              <Button className="signupSubmitButton" onClick={handleLogin}>
                Log In
              </Button>
{/* 
              <Button
                className="secondaryButton"

                onClick={handleCompleteProfile}
              >
                Complete Your Profile
              </Button> */}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
