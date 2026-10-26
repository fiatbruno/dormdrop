
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

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
  ArrowLeft,
  Menu,
  X,
  ShieldAlert,
} from "lucide-react";

import AdminLogout from "../../components/AdminLogout";

import {
  getAdminUserDetails,
  getAdminUserListings,
  getModerationHistory,
  getAdminNotes,
  addAdminNote,
  sendPolicyWarning,
  suspendAdminUser,
  getAdminListingDetails,
} from "../../api/adminUsersApi";

import "./AdminUserDetails.css";


const navigation = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    path: "/admin",
  },
  {
    label: "Reports",
    icon: Flag,
    path: "/admin/reports",
  },
  {
    label: "Listings",
    icon: Box,
    path: "/admin/listings",
  },
  {
    label: "Users",
    icon: Users,
    path: "/admin/users",
  },
  {
    label: "Appeals",
    icon: Undo2,
    path: "/admin/appeals",
  },
  {
    label: "Activity log",
    icon: ClipboardList,
    path: "/admin/activity",
  },
  {
    label: "Settings",
    icon: Settings,
    path: "/admin/settings",
  },
];

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function readableStatus(status) {
  if (!status) {
    return "Not available";
  }

  return String(status)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPrice(price) {
  if (price === null || price === undefined || price === "") {
    return "Not available";
  }

  const number = Number(price);

  if (!Number.isFinite(number)) {
    return "Not available";
  }

  return number.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function getErrorMessage(error) {
  if (error.response?.status === 401) {
    return "Your administrator session has expired. Please log in again.";
  }

  if (error.response?.status === 403) {
    return "You do not have permission to perform this action.";
  }

  if (error.response?.status === 404) {
    return "The requested record was not found.";
  }

  if (error.response?.status >= 500) {
    return "A server error occurred. Please try again later.";
  }

  return (
    error.response?.data?.message ||
    error.message ||
    "Something went wrong. Please try again."
  );
}

function AdminSidebar({ open, onClose }) {
  return (
    <aside
      className={`admin-sidebar ${
        open ? "admin-sidebar-open" : ""
      }`}
    >
      <div className="admin-brand">
        <strong>DormDrop</strong>

        <button
          type="button"
          className="admin-mobile-close"
          onClick={onClose}
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

      <p className="admin-nav-label">WORKSPACE</p>

      <nav
        className="admin-navigation"
        aria-label="Admin navigation"
      >
        {navigation.map(({ label, icon: Icon, path }) => (
          <Link
            key={label}
            to={path}
            onClick={onClose}
            className={`admin-nav-item ${
              label === "Users" ? "selected" : ""
            }`}
          >
            <Icon size={17} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        <strong>Administrator</strong>
        <span>DormDrop administration</span>

        <AdminLogout />
      </div>
    </aside>
  );
}


function AdminHeader({
  search,
  setSearch,
  onMenuClick,
  userId,
}) {
  return (
    <header className="admin-topbar">
      <button
        type="button"
        className="admin-menu-button"
        onClick={onMenuClick}
        aria-label="Open sidebar"
      >
        <Menu size={22} />
      </button>

      <div className="admin-breadcrumb">
        Admin / User {userId}
      </div>

      <div className="admin-search">
        <Search size={17} />

        <input
          type="search"
          placeholder="Search reports or listings"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search user reports and listings"
        />
      </div>

      <div className="admin-top-actions">
        <Link to="/">View marketplace</Link>

        <button
          type="button"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell size={18} />
        </button>

        <span className="admin-avatar">AD</span>
      </div>
    </header>
  );
}

function AccountOverview({ user }) {
  return (
    <section className="admin-card">
      <h2>Account overview</h2>

      <div className="admin-status-row">
        <span className="admin-status active">
          {readableStatus(user.status)}
        </span>

        {user.emailVerified === true && (
          <span className="admin-status verified">
            Email verified
          </span>
        )}
      </div>

      <dl className="admin-account-details">
        <dt>Campus email</dt>
        <dd>{user.email || "Not available"}</dd>

        <dt>Campus</dt>
        <dd>{user.campus || "Not available"}</dd>

        <dt>Role</dt>
        <dd>{readableStatus(user.role)}</dd>

        <dt>Active listings</dt>
        <dd>{user.activeListings ?? "Not available"}</dd>

        <dt>Joined</dt>
        <dd>{formatDate(user.joinedAt)}</dd>

        <dt>Last active</dt>
        <dd>{formatDate(user.lastActiveAt)}</dd>
      </dl>
    </section>
  );
}


function AccountActions({ user, onAction }) {
  const isSuspended = user.status === "SUSPENDED";

  return (
    <section className="admin-card admin-actions-card">
      <h2>Account actions</h2>

      <p>
        Review the available evidence before taking
        moderation action against this account.
      </p>

      <button
        type="button"
        className="admin-warning-button"
        onClick={() => onAction("warning")}
      >
        Send policy warning
      </button>

      <button
        type="button"
        className="admin-suspend-button"
        disabled={isSuspended}
        onClick={() => onAction("suspend")}
      >
        {isSuspended
          ? "Account suspended"
          : "Suspend account"}
      </button>

      <small>
        Account restrictions are enforced by the backend
        according to DormDrop's moderation policies.
      </small>
    </section>
  );
}


function ModerationHistory({ reports }) {
  return (
    <section className="admin-card">
      <h2>Moderation history</h2>

      <div className="admin-report-list">
        {reports.length === 0 ? (
          <p>No moderation records found.</p>
        ) : (
          reports.map((report) => (
            <article
              className="admin-report"
              key={report.id}
            >
              <div className="admin-report-heading">
                <strong>
                  {report.id} ·{" "}
                  {readableStatus(report.status)}
                </strong>

                <time>
                  {formatDate(report.createdAt)}
                </time>
              </div>

              <p>
                {report.description ||
                  "No description provided."}
              </p>
            </article>
          ))
        )}
      </div>

      <p className="admin-history-note">
        A report does not automatically establish a
        policy violation. Review supporting evidence
        before making a moderation decision.
      </p>
    </section>
  );
}



function InternalNotes({
  notes,
  onAddNote,
  saving,
}) {
  const [content, setContent] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return;
    }

    const success = await onAddNote(trimmedContent);

    if (success) {
      setContent("");
    }
  }

  return (
    <section className="admin-card admin-notes-card">
      <h2>Internal notes</h2>

      {notes.length === 0 ? (
        <p>No internal notes yet.</p>
      ) : (
        notes.map((note) => (
          <article
            key={note.id}
            className="admin-note-entry"
          >
            <p>{note.content}</p>

            <span>
              {note.authorName || "Unknown administrator"}
              {" · "}
              {formatDate(note.createdAt)}
            </span>
          </article>
        ))
      )}

      <form
        onSubmit={handleSubmit}
        className="admin-note-form"
      >
        <label htmlFor="admin-new-note">
          Add internal note
        </label>

        <textarea
          id="admin-new-note"
          value={content}
          onChange={(event) =>
            setContent(event.target.value)
          }
          placeholder="Write a note for the moderation team..."
          maxLength={2000}
          rows={3}
          required
        />

        <button
          type="submit"
          className="admin-warning-button"
          disabled={saving || !content.trim()}
        >
          {saving ? "Saving..." : "Save note"}
        </button>
      </form>

      <small>
        Internal notes are visible only to authorized
        administrators.
      </small>
    </section>
  );
}



function UserListings({
  listings,
  onReview,
}) {
  return (
    <section className="admin-card admin-listings-card">
      <h2>User listings</h2>

      {listings.length === 0 ? (
        <p>No listings found.</p>
      ) : (
        listings.map((listing) => (
          <article
            className="admin-listing"
            key={listing.id}
          >
            {listing.imageUrl ? (
              <img
                src={listing.imageUrl}
                alt={listing.title || "Listing image"}
              />
            ) : (
              <div className="admin-listing-placeholder">
                <Box size={26} />
              </div>
            )}

            <div className="admin-listing-info">
              <strong>
                {listing.title || "Untitled listing"}
              </strong>

              <span>
                {formatPrice(listing.price)}
                {" · "}
                {listing.id}
                {" · "}
                {readableStatus(listing.status)}
              </span>
            </div>

            <button
              type="button"
              className="admin-review-button"
              onClick={() => onReview(listing.id)}
            >
              Review
            </button>
          </article>
        ))
      )}
    </section>
  );
}

function ModerationDialog({
  action,
  onClose,
  onSubmit,
  saving,
}) {
  const [reason, setReason] = useState("");
  const [durationDays, setDurationDays] =
    useState("7");

  if (!action) {
    return null;
  }

  const isSuspension = action === "suspend";

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      return;
    }

    await onSubmit({
      action,
      reason: trimmedReason,
      durationDays: Number(durationDays),
    });
  }

  return (
    <div
      className="admin-modal-overlay"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="moderation-dialog-title"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <ShieldAlert
          size={28}
          color={
            isSuspension
              ? "#b42318"
              : "#194278"
          }
        />

        <h2 id="moderation-dialog-title">
          {isSuspension
            ? "Suspend account"
            : "Send policy warning"}
        </h2>

        <p>
          {isSuspension
            ? "Provide a reason and select the suspension duration."
            : "Provide the reason for this policy warning."}
        </p>

        <form
          onSubmit={handleSubmit}
          className="admin-action-form"
        >
          <label htmlFor="moderation-reason">
            Reason
          </label>

          <textarea
            id="moderation-reason"
            value={reason}
            onChange={(event) =>
              setReason(event.target.value)
            }
            placeholder="Explain the confirmed issue..."
            maxLength={2000}
            rows={4}
            required
          />

          {isSuspension && (
            <>
              <label htmlFor="suspension-duration">
                Suspension duration
              </label>

              <select
                id="suspension-duration"
                value={durationDays}
                onChange={(event) =>
                  setDurationDays(event.target.value)
                }
              >
                <option value="1">1 day</option>
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
            </>
          )}

          <div className="admin-modal-buttons">
            <button
              type="button"
              className="admin-warning-button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className={
                isSuspension
                  ? "admin-suspend-button"
                  : "admin-warning-button"
              }
              disabled={
                saving || !reason.trim()
              }
            >
              {saving
                ? "Processing..."
                : isSuspension
                ? "Confirm suspension"
                : "Send warning"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


function ListingDialog({
  listing,
  onClose,
}) {
  if (!listing) {
    return null;
  }

  return (
    <div
      className="admin-modal-overlay"
      onClick={onClose}
    >
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="listing-dialog-title"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <h2 id="listing-dialog-title">
          {listing.title || "Listing details"}
        </h2>

        <p>
          Listing ID: {listing.id}
        </p>

        <p>
          Price: {formatPrice(listing.price)}
        </p>

        <p>
          Status: {readableStatus(listing.status)}
        </p>

        <button
          type="button"
          className="admin-warning-button"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}



export default function AdminUserDetails() {
  const { userId } = useParams();


  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [reports, setReports] = useState([]);
  const [notes, setNotes] = useState([]);


  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);


  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");


  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [action, setAction] = useState(null);

  const [selectedListing, setSelectedListing] =
    useState(null);


  const [loadedUserId, setLoadedUserId] =
    useState(null);



  const loadData = useCallback(async () => {
    setLoading(true);


    setUser(null);
    setListings([]);
    setReports([]);
    setNotes([]);


    setError("");
    setSuccess("");
    setSearch("");
    setAction(null);
    setSelectedListing(null);
    setLoadedUserId(null);

    const [
      userResult,
      listingsResult,
      historyResult,
      notesResult,
    ] = await Promise.allSettled([
      getAdminUserDetails(userId),
      getAdminUserListings(userId),
      getModerationHistory(userId),
      getAdminNotes(userId),
    ]);

    if (userResult.status === "rejected") {
      throw userResult.reason;
    }

    // All sections must load successfully.
    // This prevents missing API data from being
    // incorrectly displayed as empty records.
    const failedResult = [
      listingsResult,
      historyResult,
      notesResult,
    ].find((result) => result.status === "rejected");

    if (failedResult) {
      throw failedResult.reason;
    }

    return {
      user: userResult.value,
      listings: listingsResult.value,
      reports: historyResult.value,
      notes: notesResult.value,
    };
  }, [userId]);

  useEffect(() => {
    let active = true;

    async function fetchData() {
      try {
        const data = await loadData();

        // Prevent a previous request from overwriting
        // another user's profile after navigation.
        if (!active) return;

        if (
          !data.user ||
          !Array.isArray(data.listings) ||
          !Array.isArray(data.reports) ||
          !Array.isArray(data.notes)
        ) {
          throw new Error(
            "The backend returned an unexpected response format."
          );
        }

        setUser(data.user);
        setListings(data.listings);
        setReports(data.reports);
        setNotes(data.notes);
        setLoadedUserId(userId);
      } catch (err) {
        if (active) {
          setError(getErrorMessage(err));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      active = false;
    };
  }, [loadData, userId]);



  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return reports;
    }

    return reports.filter((report) =>
      `${report.id} ${report.status} ${report.description}`
        .toLowerCase()
        .includes(query)
    );
  }, [reports, search]);



  const filteredListings = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return listings;
    }

    return listings.filter((listing) =>
      `${listing.id} ${listing.title} ${listing.status}`
        .toLowerCase()
        .includes(query)
    );
  }, [listings, search]);


  async function handleAddNote(content) {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await addAdminNote(userId, content);

      const updatedNotes =
        await getAdminNotes(userId);

      if (!Array.isArray(updatedNotes)) {
        throw new Error(
          "The backend returned an invalid notes response."
        );
      }

      setNotes(updatedNotes);

      setSuccess(
        "Internal note saved successfully."
      );

      return true;
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    } finally {
      setSaving(false);
    }
  }


  async function handleModeration({
    action,
    reason,
    durationDays,
  }) {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (action === "warning") {
        await sendPolicyWarning(
          userId,
          reason
        );
      } else if (action === "suspend") {
        await suspendAdminUser(
          userId,
          reason,
          durationDays
        );
      } else {
        throw new Error(
          "Unsupported moderation action."
        );
      }


      setAction(null);

      setSuccess(
        action === "warning"
          ? "Policy warning sent successfully."
          : "Account suspended successfully."
      );


      const [
        updatedUser,
        updatedHistory,
      ] = await Promise.all([
        getAdminUserDetails(userId),
        getModerationHistory(userId),
      ]);

      if (
        !updatedUser ||
        !Array.isArray(updatedHistory)
      ) {
        throw new Error(
          "Moderation succeeded, but the updated records could not be loaded."
        );
      }

      setUser(updatedUser);
      setReports(updatedHistory);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }


  async function handleReview(listingId) {
    setError("");

    try {
      const listing =
        await getAdminListingDetails(
          listingId
        );

      if (!listing) {
        throw new Error(
          "Listing details were not returned."
        );
      }

      setSelectedListing(listing);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }



  const isCurrentUserLoaded =
    loadedUserId === userId;

  return (
    <div className="admin-page">
      <AdminSidebar
        open={sidebarOpen}
        onClose={() =>
          setSidebarOpen(false)
        }
      />

      <div className="admin-main">
        <AdminHeader
          search={search}
          setSearch={setSearch}
          onMenuClick={() =>
            setSidebarOpen(true)
          }
          userId={userId}
        />

        <main className="admin-content">
          {error && (
            <div
              className="admin-feedback admin-feedback-error"
              role="alert"
            >
              {error}
            </div>
          )}

          {success && (
            <div
              className="admin-feedback admin-feedback-success"
              role="status"
            >
              {success}
            </div>
          )}

          {loading ? (
            <div className="admin-loading">
              Loading user details...
            </div>
          ) : !user || !isCurrentUserLoaded ? (
            <div className="admin-card">
              <h2>Unable to load user</h2>

              <p>
                User information could not be retrieved.
              </p>
            </div>
          ) : (
            <>
              <div className="admin-page-heading">
                <div>
                  <h1>
                    {user.name ||
                      "Name not available"}
                  </h1>

                  <p>
                    {user.id}
                    {" · "}
                    {user.campus ||
                      "Campus not available"}
                    {" · "}
                    Joined{" "}
                    {formatDate(user.joinedAt)}
                  </p>
                </div>

                <Link
                  to="/admin/users"
                  className="admin-back-link"
                >
                  <ArrowLeft size={16} />
                  Back to users
                </Link>
              </div>

              <div className="admin-dashboard-grid">
                <AccountOverview
                  user={user}
                />

                <AccountActions
                  user={user}
                  onAction={setAction}
                />

                <ModerationHistory
                  reports={filteredReports}
                />

                <InternalNotes
                  key={userId}
                  notes={notes}
                  onAddNote={handleAddNote}
                  saving={saving}
                />

                <UserListings
                  listings={filteredListings}
                  onReview={handleReview}
                />
              </div>
            </>
          )}
        </main>
      </div>

      {action && (
        <ModerationDialog
          key={`${userId}-${action}`}
          action={action}
          onClose={() =>
            setAction(null)
          }
          onSubmit={handleModeration}
          saving={saving}
        />
      )}

      {selectedListing && (
        <ListingDialog
          listing={selectedListing}
          onClose={() =>
            setSelectedListing(null)
          }
        />
      )}
    </div>
  );
}
