
import ListingImage from "../../components/ListingImage";
import useAuth from "../../hooks/useAuth";
import Button from "../../components/Button/Button";
import { useEffect, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import "./Profile.css";
import useProfile from "../../hooks/useProfile";
import DeleteAccountDialog from "./DeleteAccountDialog";
import { getStaffIdentity } from "../../auth/staffCapabilities";

function ListingCards({
  items,
  onMarkSold,
  onRelist,
  onVisibility,
  pending,
}) {
  if (items.length === 0) {
    return <p className="profile-empty">No listings to show.</p>;
  }

  return (
    <div className="profile-listing-grid">
      {items.map((item) => (
        <article className="profile-listing-card" key={item.id}>
          <Link to={`/items/${encodeURIComponent(item.id)}`} className="profile-listing-image">
            {item.imageUrl || item.image ? (
              <ListingImage
                fallback={<span>No image available</span>}
                src={item.imageUrl || item.image}
                alt={item.title}
                loading="lazy"
              />
            ) : (
              <span>No image available</span>
            )}
          </Link>

          <div className="profile-listing-content">
            <p className="profile-category">{item.category}</p>
            <h3>{item.title}</h3>

            <div className="profile-price-row">
              <strong>
                {item.listingType === "Trade"
                  ? "Trade"
                  : Number(item.price) === 0
                    ? "Free"
                    : `$${Number(item.price).toFixed(2)}`}
              </strong>

              <span
                className={
                  item.sellerHidden ? "profile-badge is-hidden" : item.status === "SOLD"
                    ? "profile-badge sold"
                    : "profile-badge"
                }
              >
                {item.sellerHidden ? "Hidden" : item.status === "SOLD" ? "SOLD" : "Available"}
              </span>
            </div>
          </div>

          <div className="profile-card-actions">
            {item.status === "SOLD" ? (
              <>
                <Link to={`/items/${encodeURIComponent(item.id)}`}>
                  View listing
                </Link>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onRelist?.(item.id)}
                >
                  Relist this item
                </button>
              </>
            ) : (
              <>
                <Link
                  to={`/edit-listing/${encodeURIComponent(item.id)}`}
                >
                  Edit listing
                </Link>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onMarkSold?.(item.id)}
                >
                  Mark as sold
                </button>
              </>
            )}
            {(!item.moderationVisibility || item.moderationVisibility === "VISIBLE") && (
              <Button type="button" disabled={pending} onClick={() => onVisibility(item)}>
                {item.sellerHidden ? "Restore listing" : "Hide listing"}
              </Button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function VisibilityDialog({ item, complete, pending, error, onConfirm, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  const restoring = item.sellerHidden;
  const action = restoring ? "Restore listing" : "Hide listing";
  const price = item.listingType === "Trade" ? "Trade" : Number(item.price) === 0
    ? "Free" : `$${Number(item.price).toFixed(2).replace(/\.00$/, "")}`;

  return (
    <dialog
      ref={dialog}
      className="profile-visibility-dialog"
      aria-labelledby="listing-visibility-title"
      onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}
    >
      <div className="profile-visibility-content">
        {complete && <span className="profile-visibility-success">{restoring ? "Visible" : "Done"}</span>}
        <h2 id="listing-visibility-title">
          {complete ? (restoring ? "Listing restored" : "Listing hidden")
            : (restoring ? "Restore this listing?" : "Hide this listing?")}
        </h2>
        {complete ? (
          <>
            <p>{restoring ? "Your listing is visible to buyers again."
              : "Buyers cannot see this item in browse or search. You can restore it from your listings."}</p>
            <Button type="button" className="profile-visibility-primary" onClick={onClose}>Done</Button>
          </>
        ) : (
          <>
            <p>{item.title} · {price}</p>
            <div className="profile-visibility-info">
              <strong>{restoring ? "Visible to buyers" : "Hidden from buyers"}</strong>
              <p>{restoring ? "Your listing will appear in browse and search again."
                : "Your listing will disappear from browse and search. You can make it visible again later."}</p>
            </div>
            {error && <p className="profile-visibility-error" role="alert">{error}</p>}
            <div className="profile-visibility-actions">
              <Button type="button" disabled={pending} onClick={onClose}>Cancel</Button>
              <Button type="button" className="profile-visibility-primary" disabled={pending} onClick={onConfirm}>
                {pending ? "Saving…" : action}
              </Button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}

function Profile({
  user = null,
  listings = [],
  loading = false,
  refreshing = false,
  error = "",
  onSaveProfile,
  onMarkSold,
  onRelist,
  onResetPassword,
  onUpdateVisibility,
}) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [pending, setPending] = useState(false);
  const [visibilityDialog, setVisibilityDialog] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      // Populate editable fields when server profile data changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(user.name || "");
      setBio(user.about || "");
    }
  }, [user]);

  const activeListings = listings.filter(
    (item) =>
      item.status === "AVAILABLE" ||
      item.status === "ACTIVE"
  );

  const soldListings = listings.filter(
    (item) => item.status === "SOLD"
  );

  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?";

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  async function saveProfile(event) {
    event.preventDefault();

    if (!onSaveProfile) return;

    setPending(true);
    setMessage("");
    setActionError("");

    try {
      await onSaveProfile({
        name: name.trim(),
        about: bio.trim(),
      });

      setMessage("Profile updated successfully!");
    } catch {
      setActionError(
        "Unable to save profile. Please try again."
      );
    } finally {
      setPending(false);
    }
  }

  async function changeListingStatus(id, sold) {
    setPending(true);
    setMessage("");
    setActionError("");

    try {
      if (sold) {
        await onMarkSold(id);
        setMessage("Listing marked as sold.");
      } else {
        await onRelist(id);
        setMessage("Listing is available again.");
      }
    } catch {
      setActionError(
        "Unable to update listing. Please try again."
      );
    } finally {
      setPending(false);
    }
  }

  async function confirmVisibility() {
    const { item } = visibilityDialog;
    setVisibilityDialog({ item, pending: true });
    try {
      await onUpdateVisibility(item.id, !item.sellerHidden);
      setVisibilityDialog({ item, complete: true });
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.detail || err.response?.data?.message;
      const fallback = {
        401: "Sign in again to change listing visibility.",
        403: "Only the listing owner can change its visibility.",
        404: "The visibility endpoint is unavailable. Make sure the backend is running the latest version, then try again.",
        409: "This listing is restricted or has changed. Refresh before trying again.",
      };
      setVisibilityDialog({ item, error: message || fallback[status] || "Could not update visibility. Please try again." });
    }
  }

  async function resetPassword() {
    if (!onResetPassword) return;

    setPending(true);
    setMessage("");
    setActionError("");

    try {
      await onResetPassword();
      setMessage(
        "Password reset request sent. Check your email."
      );
    } catch {
      setActionError(
        "Unable to request a password reset."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <main className="profile-page">
        <Navbar showSearch={false} />

        <header className="profile-heading">
          <h1>Profile</h1>
          <p>
            Your campus identity, listings, and account controls.
          </p>
        </header>

        <div className="profile-layout">
          <aside className="profile-sidebar">
            <a href="#your-profile">Your profile</a>
            <a href="#account-security">Account security</a>
            <a href="#delete-account">Delete account</a>
            <a href="#my-listings">Active listings</a>
            <a href="#sold-listings">Sold listings</a>
            <Link to="/my-reports">My reports</Link>
            {getStaffIdentity(user).canReview && (
              <Link to="/staff/reports">Review reports</Link>
            )}

            <button
              type="button"
              className="profile-logout"
              onClick={handleLogout}
            >
              Log out
            </button>
          </aside>

          <div className="profile-main">
            {error && (
              <p className="profile-error" role="alert">
                {error}
              </p>
            )}

            {actionError && (
              <p className="profile-error" role="alert">
                {actionError}
              </p>
            )}

            {message && (
              <p className="profile-success" role="status">
                {message}
              </p>
            )}

            {refreshing && !loading && (
              <p className="profile-success" role="status">
                Refreshing your listings...
              </p>
            )}

            {loading ? (
              <p>Loading your profile...</p>
            ) : (
              <>
                <section
                  id="your-profile"
                  className="profile-section"
                >
                  <div className="profile-user">
                    <div className="profile-avatar">
                      {initials}
                    </div>

                    <div>
                      <h2>{name || "Your profile"}</h2>

                      <p>
                        {user?.campus || "Campus not available"}
                      </p>

                      <span className="profile-verified">
                        {user?.emailVerified
                          ? "Campus email verified"
                          : "Email not verified"}
                      </span>
                    </div>
                  </div>

                  <form
                    onSubmit={saveProfile}
                    className="profile-form"
                  >
                    <div className="profile-form-grid">
                      <div className="profile-field">
                        <label htmlFor="displayName">
                          Display name
                        </label>

                        <input
                          id="displayName"
                          value={name}
                          onChange={(event) =>
                            setName(event.target.value)
                          }
                          maxLength={100}
                          required
                        />
                      </div>

                      <div className="profile-field">
                        <label htmlFor="campus">
                          Campus
                        </label>

                        <input
                          id="campus"
                          value={user?.campus || ""}
                          readOnly
                        />
                      </div>

                      <div className="profile-field">
                        <label htmlFor="email">
                          Campus email
                        </label>

                        <input
                          id="email"
                          value={user?.email || ""}
                          readOnly
                        />

                        <small>
                          {user?.emailVerified
                            ? "Verified email"
                            : "Email not verified"}
                          {" · Not shown on listings"}
                        </small>
                      </div>

                      <div className="profile-field">
                        <label htmlFor="bio">About you</label>

                        <textarea
                          id="bio"
                          value={bio}
                          onChange={(event) =>
                            setBio(event.target.value)
                          }
                          maxLength={300}
                          rows={2}
                          placeholder="Keeping good finds on campus."
                        />

                        <small>
                          Shown on your public profile.
                        </small>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="profile-save-button"
                      disabled={!onSaveProfile || pending}
                    >
                      {pending
                        ? "Please wait..."
                        : "Save changes"}
                    </button>
                  </form>
                </section>

                <section
                  id="account-security"
                  className="profile-security"
                >
                  <div>
                    <h2>Account security</h2>
                    <p>
                      Request an email link to reset your password.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={resetPassword}
                    disabled={!onResetPassword || pending}
                  >
                    Reset password
                  </button>
                </section>

                <section className="profile-security profile-delete-account" id="delete-account">
                  <div>
                    <h2>Delete account</h2>
                    <p>Permanently remove your account and listings.</p>
                  </div>
                  <Button type="button" onClick={() => setDeleteDialogOpen(true)}>Delete my account</Button>
                </section>

                <section
                  id="my-listings"
                  className="profile-section"
                >
                  <div className="profile-section-heading">
                    <h2>Active listings</h2>
                    <Link to="/list-an-item">
                      + List an item
                    </Link>
                  </div>

                  <ListingCards
                    items={activeListings}
                    pending={pending}
                    onVisibility={(item) => setVisibilityDialog({ item })}
                    onMarkSold={(id) =>
                      changeListingStatus(id, true)
                    }
                  />
                </section>

                <section
                  id="sold-listings"
                  className="profile-section"
                >
                  <h2>Sold listings</h2>

                  <p className="profile-section-description">
                    Items you've sold on campus.
                  </p>

                  <ListingCards
                    items={soldListings}
                    pending={pending}
                    onVisibility={(item) => setVisibilityDialog({ item })}
                    onRelist={(id) =>
                      changeListingStatus(id, false)
                    }
                  />
                </section>
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
      {deleteDialogOpen && (
        <DeleteAccountDialog
          onClose={() => setDeleteDialogOpen(false)}
          onDeleted={() => {
            navigate("/login", { replace: true, flushSync: true, state: { accountDeleted: true } });
            logout();
          }}
        />
      )}
      {visibilityDialog && (
        <VisibilityDialog
          {...visibilityDialog}
          onConfirm={confirmVisibility}
          onClose={() => setVisibilityDialog(null)}
        />
      )}
    </>
  );
}

function ProfilePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const profileData = useProfile();

  const { refreshProfile } = profileData;
  const listingUpdatedAt = location.state?.listingUpdatedAt;

  useEffect(() => {
    if (!listingUpdatedAt) return;

    refreshProfile();

    navigate(
      {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      },
      {
        replace: true,
        state: null,
      }
    );
  }, [
    listingUpdatedAt,
    refreshProfile,
    navigate,
    location.pathname,
    location.search,
    location.hash,
  ]);

  return <Profile {...profileData} />;
}

export default ProfilePage;
