
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

import {
  LayoutDashboard,
  Flag,
  Box,
  Users,
  Undo2,
  ClipboardList,
  Settings,
  Search,
  Bell,
  Menu,
  X,
} from "lucide-react";

import AdminLogout from "../AdminLogout";
import logo from "../../assets/Logo.png";
import "../../pages/Admin/AdminUserDetails.css";

const navigation = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    to: "/admin",
  },
  {
    label: "Reports",
    icon: Flag,
    to: "/admin/reports",
  },
  {
    label: "Listings",
    icon: Box,
    to: "/admin/listings",
  },
  {
    label: "Users",
    icon: Users,
    to: "/admin/users",
  },
  {
    label: "Appeals",
    icon: Undo2,
    to: "/admin/appeals",
  },
  {
    label: "Activity log",
    icon: ClipboardList,
    to: "/admin/activity",
  },
  {
    label: "Settings",
    icon: Settings,
    to: "/admin/settings",
  },
];

export default function AdminLayout({
  children,
  breadcrumb = "Admin",
  search = "",
  onSearchChange,
  showSearch = true,
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
            to="/admin/users"
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
            .filter(
              (item) => item.to === "/admin/users"
            )
            .map(({ label, icon: Icon, to }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/admin"}
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
          <strong>Administrator</strong>
          <span>DormDrop administration</span>
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
                placeholder="Search reports or listings"
                value={search}
                onChange={(event) =>
                  onSearchChange?.(
                    event.target.value
                  )
                }
                aria-label="Search admin records"
                readOnly={!onSearchChange}
              />
            </div>
          )}

          <div className="admin-top-actions">
            <Link to="/home">
              View marketplace
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
