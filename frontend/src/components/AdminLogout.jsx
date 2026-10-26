
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { adminLogout } from "../api/adminAuthApi";

export default function AdminLogout() {
  const navigate = useNavigate();

  function handleLogout() {
    adminLogout();
    navigate("/admin/login", { replace: true });
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "9px",
        width: "100%",
        padding: "10px 12px",
        marginTop: "12px",
        background: "transparent",
        color: "#ffffff",
        border: "1px solid rgba(255,255,255,0.2)",
        borderRadius: "6px",
        cursor: "pointer",
        fontSize: "12px",
      }}
    >
      <LogOut size={16} />
      Sign out
    </button>
  );
}
