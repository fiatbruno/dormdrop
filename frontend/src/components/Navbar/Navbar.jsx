import { useEffect, useId, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, Plus, Search, UserRound, X } from "lucide-react";
import logo from "../../assets/Logo.png";
import "./Navbar.css";

const defaultLinks = [
  { label: "Browse", to: "/home" },
  { label: "Saved", to: "/saved-item" },
  { label: "Messages", to: "/messages" },
  { label: "Profile", to: "/profile" },
];

function NavbarContent({
  variant = "marketplace",
  authAction = "signup",
  showSearch = true,
  searchValue = "",
  onSearchChange,
  links = defaultLinks,
  profilePath = "/profile",
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const toggleRef = useRef(null);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1001px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  if (variant === "auth") {
    return (
      <header className="dormdrop-navbar dormdrop-navbar--auth">
        <div className="dormdrop-navbar__inner">
          <Link className="dormdrop-navbar__brand" to="/login">
            <img src={logo} alt="DormDrop home" />
          </Link>
          <Link className="dormdrop-navbar__signup" to={authAction === "login" ? "/login" : "/signup"}>
            {authAction === "login" ? "Log In" : "Sign Up"}
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className={`dormdrop-navbar${menuOpen ? " dormdrop-navbar--open" : ""}`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          closeMenu();
          toggleRef.current?.focus();
        }
      }} onClick={(event) => {
        if (event.target.closest("a")) closeMenu();
      }}>
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

        <nav id={menuId} className="dormdrop-navbar__links" aria-label="Main navigation">
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
          <Link className="dormdrop-navbar__profile dormdrop-navbar__profile--mobile" to={profilePath} aria-label="Your profile">
            <UserRound size={18} aria-hidden="true" />
          </Link>
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
          <button ref={toggleRef} type="button" className="dormdrop-navbar__toggle"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen} aria-controls={menuId}
            onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}

function Navbar(props) {
  const location = useLocation();
  return <NavbarContent key={location.key} {...props} />;
}

export default Navbar;
