import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import PasswordResetLayout from "../../components/PasswordResetLayout/PasswordResetLayout.jsx";
import { Link, useLocation, Navigate } from "react-router-dom";
export default function PasswordUpdated() {
    const location = useLocation();

    if (!location.state?.resetSuccessful) {
      return <Navigate to="/forgot-password" replace />;
    }
  return (
    <PasswordResetLayout>
      <div className="passwordResetPage__icon passwordResetPage__icon--success">
        <Check size={24} />
      </div>

      <h2>Password updated</h2>

      <p className="passwordResetPage__subtitle">
        You can now log in with your new password.
      </p>

      <Link to="/login" className="passwordResetPage__button">
        Back to log in
      </Link>

      <p className="passwordResetPage__hint" style={{ marginTop: 22 }}>
        Keep your password private. DormDrop will never ask you
        to send it in a message.
      </p>
    </PasswordResetLayout>
  );
}