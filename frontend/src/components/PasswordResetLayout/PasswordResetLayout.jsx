import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AuthLeftPanel from "../AuthLeftPanel/AuthLeftPanel.jsx";
import "../AuthLeftPanel/AuthPage.css";
import Navbar from "../Navbar/Navbar.jsx";
import "./PasswordResetLayout.css";
import Footer from "../Footer/Footer.jsx";

export default function PasswordResetLayout({
  children,
  authAction = "login",
}) {
  return (
    <div className="authPage passwordResetPage">
      <div className="passwordResetPage__header">
        <Navbar variant="auth" authAction={authAction} />

        <Link to="/" className="passwordResetPage__marketplace">
          <ArrowLeft size={15} />
          Back to marketplace
        </Link>
      </div>

      <main className="authPage__main passwordResetPage__main">
        <AuthLeftPanel />

        <section className="passwordResetPage__right">
          <div className="passwordResetPage__content">
            {children}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}