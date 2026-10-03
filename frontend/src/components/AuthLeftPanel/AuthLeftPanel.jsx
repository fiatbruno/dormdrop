import { ShieldCheck } from "lucide-react";
import marketplaceImage from "../../assets/marketplace.png";
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
        staff nearby.
      </p>

      <img
        className="marketplaceImage"
        src={marketplaceImage}
        alt="Items available for sale on DormDrop"
      />

      <div className="communityInfo">
        <h3>Campus email. Verified community.</h3>

        <p>
          Every account starts with a .edu address.
          Meet nearby and keep good finds on campus.
        </p>
      </div>
    </div>
  );
}

export default AuthLeftPanel;