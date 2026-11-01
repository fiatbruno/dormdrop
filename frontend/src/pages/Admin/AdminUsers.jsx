
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

import AdminLayout from "../../components/AdminLayout/AdminLayout";
import Button from "../../components/Button/Button";
import { getAdminUsers } from "../../api/adminUsersApi";

import "./AdminUsers.css";

const PAGE_SIZE = 5;

const TABS = [
  { id: "all", label: "All members" },
  { id: "verified", label: "Verified" },
  { id: "unverified", label: "Unverified" },
  { id: "suspended", label: "Suspended" },
];

function normalizeStatus(value) {
  return String(value ?? "UNKNOWN")
    .trim()
    .toUpperCase();
}

function getUserId(user) {
  const id = user.id ?? user.userId ?? null;

  if (typeof id === "string") return id;

  return id?.$oid ?? null;
}

function getJoinedDate(user) {
  return user.createdAt ?? user.joinedAt ?? null;
}

function isVerified(user) {
  return user.emailVerified === true;
}

function isUnverified(user) {
  return user.emailVerified === false;
}

function isSuspended(user) {
  return normalizeStatus(user.status) === "SUSPENDED";
}

function isNewThisWeek(user) {
  const joined = getJoinedDate(user);
  if (!joined) return false;

  const date = new Date(joined);
  if (Number.isNaN(date.getTime())) return false;

  const now = Date.now();
  const difference = now - date.getTime();

  return (
    difference >= 0 &&
    difference <= 7 * 24 * 60 * 60 * 1000
  );
}

function maskEmail(email) {
  if (!email || !email.includes("@")) {
    return "Not available";
  }

  const [name, domain] = email.split("@");

  if (!name || !domain) return "Not available";

  return `${name[0]}•••@${domain}`;
}

function getListingLabel(user) {
  const count = user.activeListings;

  if (
    typeof count !== "number" ||
    !Number.isFinite(count)
  ) {
    return "—";
  }

  return `${count} active`;
}

function getErrorMessage(error) {
  switch (error.response?.status) {
    case 401:
      return "Your admin session has expired. Please log in again.";
    case 403:
      return "You do not have permission to view users.";
    case 404:
      return "The admin users endpoint is not available.";
    default:
      return (
        error.response?.data?.message ||
        error.message ||
        "Unable to load community members."
      );
  }
}

function StatCard({
  label,
  value,
  description,
  tone,
}) {
  return (
    <article className="community-stat-card">
      <p className="community-stat-label">
        {label}
      </p>

      <strong className="community-stat-value">
        {value}
      </strong>

      <p
        className={`community-stat-description ${
          tone ? `community-stat-${tone}` : ""
        }`}
      >
        {description}
      </p>
    </article>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [reloadKey, setReloadKey] = useState(0);

  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [verificationFilter, setVerificationFilter] =
    useState("all");
  const [statusFilter, setStatusFilter] =
    useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [page, setPage] = useState(1);

  // Fetch actual user records from Spring Boot.
  useEffect(() => {
    let active = true;

    async function loadUsers() {
      if (reloadKey === 0) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      try {
        const result = await getAdminUsers();

        if (!active) return;

        setUsers(result);
      } catch (err) {
        if (!active) return;

        setUsers([]);
        setError(getErrorMessage(err));
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    loadUsers();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  // Calculate statistics only from returned data.
  const stats = useMemo(() => {
    return {
      verified: users.filter(isVerified).length,
      unverified: users.filter(isUnverified).length,
      suspended: users.filter(isSuspended).length,
      newThisWeek: users.filter(
        (user) => isVerified(user) && isNewThisWeek(user)
      ).length,
    };
  }, [users]);

  // Apply tabs, search, verification, status and sort.
  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    const results = users.filter((user) => {
      const id = String(getUserId(user) ?? "");
      const name = String(user.name ?? "");
      const email = String(user.email ?? "");

      const matchesSearch =
        !query ||
        id.toLowerCase().includes(query) ||
        name.toLowerCase().includes(query) ||
        email.toLowerCase().includes(query);

      let matchesTab = true;

      if (activeTab === "verified") {
        matchesTab = isVerified(user);
      } else if (activeTab === "unverified") {
        matchesTab = isUnverified(user);
      } else if (activeTab === "suspended") {
        matchesTab = isSuspended(user);
      }

      let matchesVerification = true;

      if (verificationFilter === "verified") {
        matchesVerification = isVerified(user);
      } else if (verificationFilter === "unverified") {
        matchesVerification = isUnverified(user);
      }

      const matchesStatus =
        statusFilter === "all" ||
        normalizeStatus(user.status) ===
          statusFilter.toUpperCase();

      return (
        matchesSearch &&
        matchesTab &&
        matchesVerification &&
        matchesStatus
      );
    });

    return results.sort((a, b) => {
      const first = getJoinedDate(a);
      const second = getJoinedDate(b);

      const firstTime =
        first && !Number.isNaN(new Date(first).getTime())
          ? new Date(first).getTime()
          : null;

      const secondTime =
        second && !Number.isNaN(new Date(second).getTime())
          ? new Date(second).getTime()
          : null;

      // Put records with unknown dates last.
      if (firstTime === null) return secondTime === null ? 0 : 1;
      if (secondTime === null) return -1;

      return sortOrder === "newest"
        ? secondTime - firstTime
        : firstTime - secondTime;
    });
  }, [
    users,
    search,
    activeTab,
    verificationFilter,
    statusFilter,
    sortOrder,
  ]);

  // Reset pagination whenever the filters change.
  useEffect(() => {
    setPage(1);
  }, [
    search,
    activeTab,
    verificationFilter,
    statusFilter,
    sortOrder,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / PAGE_SIZE)
  );

  const currentPage = Math.min(page, totalPages);

  const startIndex = (currentPage - 1) * PAGE_SIZE;

  const visibleUsers = filteredUsers.slice(
    startIndex,
    startIndex + PAGE_SIZE
  );

  const firstVisible =
    filteredUsers.length === 0 ? 0 : startIndex + 1;

  const lastVisible = Math.min(
    startIndex + PAGE_SIZE,
    filteredUsers.length
  );

  function refreshUsers() {
    if (loading || refreshing) return;
    setReloadKey((previous) => previous + 1);
  }

  function renderVerification(user) {
    if (user.emailVerified === true) {
      return (
        <span className="community-text-success">
          Verified
        </span>
      );
    }

    if (user.emailVerified === false) {
      return (
        <span className="community-text-muted">
          Pending
        </span>
      );
    }

    return "Unknown";
  }

  function renderStatus(user) {
    const status = normalizeStatus(user.status);

    return (
      <span
        className={
          status === "ACTIVE"
            ? "community-text-success"
            : status === "SUSPENDED"
              ? "community-text-danger"
              : "community-text-muted"
        }
      >
        {status === "UNKNOWN"
          ? "Unknown"
          : status.charAt(0) +
            status.slice(1).toLowerCase()}
      </span>
    );
  }

  return (
    <AdminLayout
      breadcrumb="Users"
      search={search}
      onSearchChange={setSearch}
    >
      <div className="community-page">
        {/* PAGE HEADER */}

        <div className="community-page-header">
          <div>
            <h1>Community members</h1>
            <p>
              Manage campus access and respond to
              repeated policy violations.
            </p>
          </div>

          <Button
            type="button"
            className="community-refresh-button"
            onClick={refreshUsers}
            disabled={loading || refreshing}
          >
            <RefreshCw size={15} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {/* STATISTICS */}

        <div className="community-stats-grid">
          <StatCard
            label="Verified members"
            value={
              loading || error ? "—" : stats.verified
            }
            description="Campus email confirmed"
            tone="success"
          />

          <StatCard
            label="Unverified"
            value={
              loading || error ? "—" : stats.unverified
            }
            description="Awaiting email verification"
          />

          <StatCard
            label="Suspended"
            value={
              loading || error ? "—" : stats.suspended
            }
            description="Temporary access restrictions"
            tone="danger"
          />

          <StatCard
            label="New this week"
            value={
              loading || error ? "—" : stats.newThisWeek
            }
            description="Verified members joined"
          />
        </div>

        {/* MEMBER TABS */}

        <div
          className="community-tabs"
          role="tablist"
          aria-label="Member categories"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={
                activeTab === tab.id
                  ? "community-tab community-tab-active"
                  : "community-tab"
              }
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* FILTER BAR */}

        <div className="community-filter-bar">
          <label className="community-search-field">
            <Search size={17} />

            <input
              type="search"
              placeholder="Search name, campus email or user ID"
              aria-label="Search community members"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </label>

          <select
            className="community-select"
            aria-label="Verification filter"
            value={verificationFilter}
            onChange={(event) =>
              setVerificationFilter(event.target.value)
            }
          >
            <option value="all">
              Verification: all
            </option>
            <option value="verified">
              Verified
            </option>
            <option value="unverified">
              Unverified
            </option>
          </select>

          <select
            className="community-select"
            aria-label="Account status filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="all">Status: all</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>

          <select
            className="community-select community-sort"
            aria-label="Sort by joined date"
            value={sortOrder}
            onChange={(event) =>
              setSortOrder(event.target.value)
            }
          >
            <option value="newest">
              Joined: newest
            </option>
            <option value="oldest">
              Joined: oldest
            </option>
          </select>
        </div>

        {/* DIRECTORY */}

        <section className="community-directory">
          <div className="community-directory-header">
            <h2>Member directory</h2>
          </div>

          {error && (
            <div
              className="community-state community-error"
              role="alert"
            >
              <p>{error}</p>

              <Button
                type="button"
                onClick={refreshUsers}
                disabled={refreshing}
              >
                Try again
              </Button>
            </div>
          )}

          {loading ? (
            <div
              className="community-state"
              role="status"
            >
              Loading community members...
            </div>
          ) : !error && filteredUsers.length === 0 ? (
            <div className="community-state">
              {users.length === 0
                ? "No registered users were returned by the server."
                : "No members match the selected filters."}
            </div>
          ) : !error ? (
            <>
              <div className="community-table-scroll">
                <table className="community-table">
                  <thead>
                    <tr>
                      <th scope="col">
                        Member / User ID
                      </th>
                      <th scope="col">
                        Campus email
                      </th>
                      <th scope="col">
                        Verification
                      </th>
                      <th scope="col">
                        Status
                      </th>
                      <th scope="col">
                        Listings
                      </th>
                      <th scope="col">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleUsers.map((user) => {
                      const userId = getUserId(user);

                      return (
                        <tr key={userId}>
                          <td>
                            <div className="community-member-name">
                              <span>
                                {user.name ||
                                  "Name unavailable"}
                              </span>

                              <span className="community-member-id">
                                {userId
                                  ? ` · ${userId}`
                                  : ""}
                              </span>
                            </div>
                          </td>

                          <td>
                            {maskEmail(user.email)}
                          </td>

                          <td>
                            {renderVerification(user)}
                          </td>

                          <td>
                            {renderStatus(user)}
                          </td>

                          <td>
                            {getListingLabel(user)}
                          </td>

                          <td>
                            {userId ? (
                              <Link
                                className="community-view-link"
                                to={`/admin/users/${encodeURIComponent(
                                  userId
                                )}`}
                              >
                                View user
                                <span aria-hidden="true">
                                  →
                                </span>
                              </Link>
                            ) : (
                              <span className="community-text-muted">
                                Unavailable
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION */}

              <div className="community-pagination">
                <p>
                  {firstVisible}–{lastVisible} of{" "}
                  {filteredUsers.length} members
                  <span className="community-pagination-note">
                    {" "}· Personal details limited to
                    authorized admins
                  </span>
                </p>

                <div className="community-pagination-controls">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() =>
                      setPage((previous) =>
                        Math.max(1, previous - 1)
                      )
                    }
                  >
                    <ChevronLeft size={14} />
                    Previous
                  </button>

                  {Array.from(
                    { length: totalPages },
                    (_, index) => index + 1
                  ).map((number) => (
                    <button
                      type="button"
                      key={number}
                      aria-label={`Page ${number}`}
                      aria-current={
                        currentPage === number
                          ? "page"
                          : undefined
                      }
                      className={
                        currentPage === number
                          ? "community-page-number active"
                          : "community-page-number"
                      }
                      onClick={() => setPage(number)}
                    >
                      {number}
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={
                      currentPage === totalPages
                    }
                    onClick={() =>
                      setPage((previous) =>
                        Math.min(
                          totalPages,
                          previous + 1
                        )
                      )
                    }
                  >
                    Next
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </AdminLayout>
  );
}
