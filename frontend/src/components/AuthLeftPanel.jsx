import { ShieldCheck } from "lucide-react";
import "./AuthLeftPanel.css";

function AuthLeftPanel() {
  return (
    <div className="authLeftPanel">
      <div className="communityBadge">
        <ShieldCheck className="shieldIcon" />
        <span>.edu community</span>
      </div>

      <h1 className="authTitle">
        Your campus.
        <br />
        Your next find.
      </h1>

      <p className="authDescription">
        Buy, sell, donate, and swap with students, faculty, and
        <br />
        staff nearby.
      </p>

      <img
        className="marketplaceImage"
        src="src/assets/marketplace.png"
        alt="Items available for sale on DormDrop"
      />

      <div className="communityInfo">
        <h3>Campus email. Verified community.</h3>

        <p>
          Every account starts with a .edu address.
          <br />
          Meet nearby and keep good finds on campus.
        </p>
      </div>
    </div>
  );
}

export default AuthLeftPanel;