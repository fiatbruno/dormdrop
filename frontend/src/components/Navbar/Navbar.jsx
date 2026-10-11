import { Link, NavLink } from "react-router-dom";
import { Plus, Search, UserRound } from "lucide-react";
import logo from "../../assets/Logo.png";
import "./Navbar.css";

const defaultLinks = [
  { label: "Browse", to: "/home" },
  { label: "Saved", to: "/saved" },
  { label: "Messages", to: "/messages" },
  { label: "Profile", to: "/profile" },
];

function Navbar({
  showSearch = true,
  searchValue = "",
  onSearchChange,
  links = defaultLinks,
  profilePath = "/profile",
}) {
  return (
    <header className="dormdrop-navbar">
      <div className="dormdrop-navbar__inner">
        <Link className="dormdrop-navbar__brand" to="/home">
          <img src={logo} alt="DormDrop home" />
        </Link>

        {showSearch && (
          <div className="dormdrop-navbar__search" role="search">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              aria-label="Search the marketplace"
              placeholder="Search the marketplace…"
              value={searchValue}
              onChange={(event) => onSearchChange?.(event.target.value)}
              readOnly={!onSearchChange}
            />
          </div>
        )}

        <nav className="dormdrop-navbar__links" aria-label="Main navigation">
          {links.map(({ label, to }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `dormdrop-navbar__link${isActive ? " dormdrop-navbar__link--active" : ""}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="dormdrop-navbar__actions">
          <Link className="dormdrop-navbar__list-item" to="/list-an-item">
            <Plus size={18} aria-hidden="true" />
            List item
          </Link>
          <Link
            className="dormdrop-navbar__profile"
            to={profilePath}
            aria-label="Your profile"
          >
            <UserRound size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
