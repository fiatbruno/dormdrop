import { Link } from "react-router-dom";
import logo from "../../assets/Logo.png";
import "./Footer.css";




function Footer({ links = [] }) {
  return (
    <footer className="dormdrop-footer">
      <div className="dormdrop-footer__inner">
        <div className="dormdrop-footer__branding">
          <Link className="dormdrop-footer__logo" to="/home">
            <img src={logo} alt="DormDrop home" />
          </Link>
        </div>
        {links.length > 0 && (
          <nav className="dormdrop-footer__links" aria-label="Policies">
            {links.map(({ label, to }) => (
              <Link key={to} to={to}>{label}</Link>
            ))}
          </nav>
        )}
        <p className="dormdrop-footer__copyright">© {new Date().getFullYear()} DormDrop</p>
      </div>
    </footer>
  );
}

export default Footer;
