import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AuthLeftPanel from "../AuthLeftPanel/AuthLeftPanel.jsx";
import "../AuthLeftPanel/AuthPage.css";
import Navbar from "../Navbar/Navbar.jsx";
import "./PasswordResetLayout.css";

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

      <footer className="passwordResetPage__footer">
        <span>© 2026 DormDrop</span>
        <span>Built for your campus community.</span>
      </footer>
    </div>
  );
}