
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

import { Flag, MessageSquareWarning, Users, Search, Menu, X, ArrowUpRight } from "lucide-react";

import AdminLogout from "../AdminLogout";
import logo from "../../assets/Logo.png";
import "../../pages/Admin/AdminUserDetails.css";
import "./AdminLayout.css";

const navigation = [
  {
    label: "Reported listings",
    icon: Flag,
    to: "/staff/reports",
  },
  {
    label: "Reported messages",
    icon: MessageSquareWarning,
    to: "/admin/message-reports",
  },
  {
    label: "Community members",
    icon: Users,
    to: "/admin/users",
  },
];

export default function AdminLayout({
  children,
  breadcrumb = "Admin",
  search = "",
  onSearchChange,
  showSearch = true,
  showUsers = true,
}) {
  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  return (
    <div className="admin-page">
      <aside
        className={`admin-sidebar ${
          sidebarOpen ? "admin-sidebar-open" : ""
        }`}
      >
        <div className="admin-brand">
          <Link
            to={showUsers ? "/admin/users" : "/staff/reports"}
            className="admin-brand-link"
            aria-label="DormDrop administration"
          >
            <img src={logo} alt="DormDrop" />
          </Link>

          <button
            type="button"
            className="admin-mobile-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="admin-campus">
          <small>AUGUSTANA COLLEGE</small>
          <p>Campus administration</p>
          <span>Moderation workspace</span>
        </div>

        <p className="admin-nav-label">
          WORKSPACE
        </p>

        <nav
          className="admin-navigation"
          aria-label="Admin navigation"
        >
          {navigation
            .filter((item) => showUsers || item.to !== "/admin/users")
            .map(({ label, icon: Icon, to }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() =>
                  setSidebarOpen(false)
                }
                className={({ isActive }) =>
                  `admin-nav-item ${
                    isActive ? "selected" : ""
                  }`
                }
              >
                <Icon size={17} />
                <span>{label}</span>
              </NavLink>
            ))}
        </nav>

        <div className="admin-sidebar-footer">
          <strong>Campus workspace</strong>
          <span>Keep your community safe.</span>
          <AdminLogout />
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-menu-button"
            onClick={() =>
              setSidebarOpen(true)
            }
            aria-label="Open sidebar"
            aria-expanded={sidebarOpen}
          >
            <Menu size={22} />
          </button>

          <div className="admin-breadcrumb">
            {breadcrumb}
          </div>

          {showSearch && (
            <div className="admin-search">
              <Search size={17} />

              <input
                type="search"
                placeholder="Search members by name or email"
                value={search}
                onChange={(event) =>
                  onSearchChange?.(
                    event.target.value
                  )
                }
                aria-label="Search members by name or email"
                readOnly={!onSearchChange}
              />
            </div>
          )}

          <div className="admin-top-actions">
            <Link to="/home">
              View marketplace <ArrowUpRight size={15} aria-hidden="true" />
            </Link>

            <span
              className="admin-avatar"
              aria-label="Admin account"
            >
              AD
            </span>
          </div>
        </header>

        <main className="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}
