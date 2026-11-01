
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useParams,
} from "react-router-dom";

import {
  ArrowLeft,
  Box,
  ShieldAlert,
} from "lucide-react";

import AdminLayout from "../../components/AdminLayout/AdminLayout";
import Button from "../../components/Button/Button";
import ListingImage from "../../components/ListingImage";

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

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function readableStatus(value) {
  if (!value) return "Not available";

  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPrice(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Not available";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "Not available";
  }

  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function getErrorMessage(error) {
  const status = error.response?.status;

  if (status === 401) {
    return "Your administrator session has expired. Please log in again.";
  }

  if (status === 403) {
    return "You do not have permission to perform this action.";
  }

  if (status === 404) {
    return "The requested record was not found.";
  }

  if (status >= 500) {
    return "A server error occurred. Please try again later.";
  }

  return (
    error.response?.data?.message ||
    error.message ||
    "Something went wrong. Please try again."
  );
}

// ============================================
// ACCOUNT OVERVIEW
// ============================================

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

// ============================================
// ACCOUNT ACTIONS
// ============================================

function AccountActions({
  user,
  onAction,
  disabled,
}) {
  const isSuspended = user.status === "SUSPENDED";

  return (
    <section className="admin-card admin-actions-card">
      <h2>Account actions</h2>

      <p>
        Review the available evidence before taking
        moderation action against this account.
      </p>

      <Button
        type="button"
        className="admin-warning-button"
        disabled={disabled}
        onClick={() => onAction("warning")}
      >
        Send policy warning
      </Button>

      <Button
        type="button"
        className="admin-suspend-button"
        disabled={disabled || isSuspended}
        onClick={() => onAction("suspend")}
      >
        {isSuspended
          ? "Account suspended"
          : "Suspend account"}
      </Button>

      <small>
        Account restrictions are enforced by the
        backend according to DormDrop's moderation
        policies.
      </small>
    </section>
  );
}

// ============================================
// MODERATION HISTORY
// ============================================

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
              key={report.id}
              className="admin-report"
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
        Reports alone do not establish a policy
        violation. Review supporting evidence before
        taking action.
      </p>
    </section>
  );
}

// ============================================
// INTERNAL NOTES
// ============================================

function InternalNotes({
  notes,
  onAddNote,
  saving,
}) {
  const [content, setContent] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmed = content.trim();

    if (!trimmed || saving) return;

    const successful = await onAddNote(trimmed);

    if (successful) {
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
              {note.authorName ||
                "Administrator not available"}
              {" · "}
              {formatDate(note.createdAt)}
            </span>
          </article>
        ))
      )}

      <form
        className="admin-note-form"
        onSubmit={handleSubmit}
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
          disabled={saving}
          required
        />

        <Button
          type="submit"
          className="admin-warning-button"
          disabled={saving || !content.trim()}
        >
          {saving ? "Saving..." : "Save note"}
        </Button>
      </form>

      <small>
        Internal notes are visible only to
        authorized administrators.
      </small>
    </section>
  );
}

// ============================================
// USER LISTINGS
// ============================================

function UserListings({
  listings,
  onReview,
  disabled,
}) {
  return (
    <section className="admin-card admin-listings-card">
      <h2>User listings</h2>

      {listings.length === 0 ? (
        <p>No listings found.</p>
      ) : (
        listings.map((listing) => (
          <article
            key={listing.id}
            className="admin-listing"
          >
            <ListingImage
              src={listing.imageUrl}
              alt={listing.title || "Listing image"}
              fallback={
                <div className="admin-listing-placeholder">
                  <Box size={26} />
                </div>
              }
            />

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

            <Button
              type="button"
              className="admin-review-button"
              disabled={disabled}
              onClick={() => onReview(listing.id)}
            >
              Review
            </Button>
          </article>
        ))
      )}
    </section>
  );
}

// ============================================
// MODERATION DIALOG
// ============================================

function ModerationDialog({
  action,
  onClose,
  onSubmit,
  saving,
}) {
  const [reason, setReason] = useState("");
  const [durationDays, setDurationDays] =
    useState("7");

  const isSuspension = action === "suspend";

  async function handleSubmit(event) {
    event.preventDefault();

    if (!reason.trim() || saving) return;

    await onSubmit({
      action,
      reason: reason.trim(),
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
        onClick={(event) => event.stopPropagation()}
      >
        <ShieldAlert
          size={28}
          color={
            isSuspension ? "#b42318" : "#194278"
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
          className="admin-action-form"
          onSubmit={handleSubmit}
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
            disabled={saving}
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
                disabled={saving}
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
            <Button
              type="button"
              className="admin-warning-button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              className={
                isSuspension
                  ? "admin-suspend-button"
                  : "admin-warning-button"
              }
              disabled={saving || !reason.trim()}
            >
              {saving
                ? "Processing..."
                : isSuspension
                  ? "Confirm suspension"
                  : "Send warning"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// LISTING DETAILS DIALOG
// ============================================

function ListingDialog({
  listing,
  onClose,
}) {
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
        onClick={(event) => event.stopPropagation()}
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

        <Button
          type="button"
          className="admin-warning-button"
          onClick={onClose}
        >
          Close
        </Button>
      </div>
    </div>
  );
}

// ============================================
// MAIN USER DETAILS COMPONENT
// ============================================

function AdminUserDetailsContent({ userId }) {
  // Real API data
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [reports, setReports] = useState([]);
  const [notes, setNotes] = useState([]);

  // Request states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  // Feedback
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // UI state
  const [search, setSearch] = useState("");
  const [action, setAction] = useState(null);
  const [selectedListing, setSelectedListing] =
    useState(null);

  // Tracks the ID associated with loaded data
  const [loadedUserId, setLoadedUserId] =
    useState(null);

  // ==========================================
  // LOAD USER DATA FROM BACKEND
  // ==========================================

  useEffect(() => {
    let active = true;

    async function loadUserData() {
      setLoading(true);

      // Clear all data belonging to the
      // previously displayed user.
      setUser(null);
      setListings([]);
      setReports([]);
      setNotes([]);

      // Clear messages and dialogs.
      setError("");
      setSuccess("");
      setSearch("");
      setAction(null);
      setSelectedListing(null);

      // Mark the current data as unloaded.
      setLoadedUserId(null);

      try {
        const [
          userData,
          listingsData,
          reportsData,
          notesData,
        ] = await Promise.all([
          getAdminUserDetails(userId),
          getAdminUserListings(userId),
          getModerationHistory(userId),
          getAdminNotes(userId),
        ]);

        // Ignore results from an outdated request.
        if (!active) return;

        // Validate the response format.
        if (
          !userData ||
          typeof userData !== "object" ||
          Array.isArray(userData) ||
          !Array.isArray(listingsData) ||
          !Array.isArray(reportsData) ||
          !Array.isArray(notesData)
        ) {
          throw new Error(
            "The backend returned an unexpected response format."
          );
        }

        setUser(userData);
        setListings(listingsData);
        setReports(reportsData);
        setNotes(notesData);

        // Only now mark this user as loaded.
        setLoadedUserId(userId);
      } catch (err) {
        if (!active) return;

        setError(getErrorMessage(err));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadUserData();

    return () => {
      active = false;
    };
  }, [userId]);

  // ==========================================
  // FILTER MODERATION HISTORY
  // ==========================================

  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return reports;

    return reports.filter((report) =>
      `${report.id} ${report.status} ${report.description}`
        .toLowerCase()
        .includes(query)
    );
  }, [reports, search]);

  // ==========================================
  // FILTER LISTINGS
  // ==========================================

  const filteredListings = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return listings;

    return listings.filter((listing) =>
      `${listing.id} ${listing.title} ${listing.status}`
        .toLowerCase()
        .includes(query)
    );
  }, [listings, search]);

  // ==========================================
  // ADD INTERNAL NOTE
  // ==========================================

  async function handleAddNote(content) {
    if (saving) return false;

    setSaving(true);
    setError("");
    setSuccess("");

    let noteSaved = false;

    try {
      await addAdminNote(userId, content);
      noteSaved = true;

      const updatedNotes = await getAdminNotes(userId);

      if (!Array.isArray(updatedNotes)) {
        throw new Error(
          "The backend returned an invalid notes response."
        );
      }

      setNotes(updatedNotes);
      setSuccess("Internal note saved successfully.");

      return true;
    } catch (err) {
      setError(
        noteSaved
          ? "The note was saved, but the notes list could not be refreshed. " +
            getErrorMessage(err)
          : getErrorMessage(err)
      );

      // Clear the input if the backend saved
      // the note, even if refreshing failed.
      return noteSaved;
    } finally {
      setSaving(false);
    }
  }

  // ==========================================
  // SEND WARNING OR SUSPEND USER
  // ==========================================

  async function handleModeration({
    action: selectedAction,
    reason,
    durationDays,
  }) {
    if (saving) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (selectedAction === "warning") {
        await sendPolicyWarning(userId, reason);
      } else if (selectedAction === "suspend") {
        await suspendAdminUser(
          userId,
          reason,
          durationDays
        );
      } else {
        throw new Error("Unsupported moderation action.");
      }
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
      return;
    }

    // The action succeeded on the backend.
    setAction(null);

    setSuccess(
      selectedAction === "warning"
        ? "Policy warning sent successfully."
        : "Account suspended successfully."
    );

    try {
      const [
        updatedUser,
        updatedReports,
      ] = await Promise.all([
        getAdminUserDetails(userId),
        getModerationHistory(userId),
      ]);

      if (
        !updatedUser ||
        !Array.isArray(updatedReports)
      ) {
        throw new Error(
          "The backend returned an invalid response."
        );
      }

      setUser(updatedUser);
      setReports(updatedReports);
    } catch (err) {
      setError(
        "The moderation action succeeded, but the updated records could not be loaded. " +
        getErrorMessage(err)
      );
    } finally {
      setSaving(false);
    }
  }

  // ==========================================
  // REVIEW A LISTING
  // ==========================================

  async function handleReview(listingId) {
    if (reviewing) return;

    setReviewing(true);
    setError("");
    setSelectedListing(null);

    try {
      const listing =
        await getAdminListingDetails(listingId);

      if (!listing || typeof listing !== "object") {
        throw new Error(
          "Listing details were not returned."
        );
      }

      setSelectedListing(listing);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setReviewing(false);
    }
  }

  // ==========================================
  // GUARD AGAINST PREVIOUS USER DATA
  // ==========================================

  const isCurrentUserLoaded =
    loadedUserId === userId;

  // ==========================================
  // PAGE RENDER
  // ==========================================

  return (
    <>
      <AdminLayout
        breadcrumb={`Admin / User ${userId}`}
        search={search}
        onSearchChange={setSearch}
      >
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
          <div
            className="admin-loading"
            role="status"
          >
            Loading user details...
          </div>
        ) : !user || !isCurrentUserLoaded ? (
          <div className="admin-card">
            <h2>Unable to load user</h2>

            <p>
              User information could not be retrieved.
            </p>

            <Link
              to="/admin/users"
              className="admin-back-link"
            >
              <ArrowLeft size={16} />
              Back to users
            </Link>
          </div>
        ) : (
          <>
            <div className="admin-page-heading">
              <div>
                <h1>
                  {user.name || "Name not available"}
                </h1>

                <p>
                  {user.id || userId}
                  {" · "}
                  {user.campus ||
                    "Campus not available"}
                  {" · "}
                  Joined {formatDate(user.joinedAt)}
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
              <AccountOverview user={user} />

              <AccountActions
                user={user}
                onAction={setAction}
                disabled={saving}
              />

              <ModerationHistory
                reports={filteredReports}
              />

              <InternalNotes
                notes={notes}
                onAddNote={handleAddNote}
                saving={saving}
              />

              <UserListings
                listings={filteredListings}
                onReview={handleReview}
                disabled={reviewing}
              />
            </div>
          </>
        )}
      </AdminLayout>

      {action && isCurrentUserLoaded && (
        <ModerationDialog
          key={`${userId}-${action}`}
          action={action}
          onClose={() => setAction(null)}
          onSubmit={handleModeration}
          saving={saving}
        />
      )}

      {selectedListing && isCurrentUserLoaded && (
        <ListingDialog
          listing={selectedListing}
          onClose={() => setSelectedListing(null)}
        />
      )}
    </>
  );
}

// ============================================
// EXPORTED PAGE
// ============================================

// The key forces a fresh component instance
// when the route changes to another user.
// This prevents previous user's state from
// carrying over between profiles.

export default function AdminUserDetails() {
  const { userId } = useParams();

  return (
    <AdminUserDetailsContent
      key={userId}
      userId={userId}
    />
  );
}
