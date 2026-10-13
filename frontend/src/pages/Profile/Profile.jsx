import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import "./Profile.css";

// Listing cards for active and sold items
function ListingCards({ items, onMarkSold, onRelist, pending }) {
  if (items.length === 0) {
    return <p className="profile-empty">No listings to show.</p>;
  }

  return (
    <div className="profile-listing-grid">
      {items.map((item) => (
        <article className="profile-listing-card" key={item.id}>
          <Link to={`/listing/${item.id}`} className="profile-listing-image">
            {item.imageUrl || item.image ? (
              <img
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
                  item.status === "SOLD"
                    ? "profile-badge sold"
                    : "profile-badge"
                }
              >
                {item.status === "SOLD" ? "SOLD" : "Available"}
              </span>
            </div>
          </div>

          <div className="profile-card-actions">
            {item.status === "SOLD" ? (
              <>
                <Link to={`/Item-listing/${item.id}`}>View listing</Link>

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
                <Link to={`/edit-listing/${encodeURIComponent(item.id)}`}>
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
          </div>
        </article>
      ))}
    </div>
  );
}

function Profile({
  user = null,
  listings = [],
  loading = false,
  error = "",
  onSaveProfile,
  onMarkSold,
  onRelist,
  onResetPassword,
  onLogout,
}) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [pending, setPending] = useState(false);

  // Fill the form when user data arrives from the backend
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setBio(user.about || "");
    }
  }, [user]);

  const activeListings = listings.filter(
    (item) => item.status === "AVAILABLE" || item.status === "ACTIVE",
  );

  function handleLogout() {
    // Remove the authentication token
    localStorage.removeItem("token");

    // Remove saved user information
    localStorage.removeItem("user");

    // Redirect to the login page
    navigate("/login", { replace: true });
  }

  const soldListings = listings.filter((item) => item.status === "SOLD");

  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?";

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
      setActionError("Unable to save profile. Please try again.");
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
        setMessage("Listing relisted successfully!");
      }
    } catch {
      setActionError("Unable to update listing. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function resetPassword() {
    if (!onResetPassword) return;

    setPending(true);
    setMessage("");
    setActionError("");

    try {
      await onResetPassword();
      setMessage("Password reset request sent. Check your email.");
    } catch {
      setActionError("Unable to request a password reset.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="profile-page">
      <Navbar showSearch={false} />

      <header className="profile-heading">
        <h1>Profile</h1>
        <p>Your campus identity, listings, and account controls.</p>
      </header>

      <div className="profile-layout">
        {/* SIDEBAR */}

        <aside className="profile-sidebar">
          <a href="#your-profile">Your profile</a>
          <a href="#account-security">Account security</a>
          <a href="#my-listings">Active listings</a>
          <a href="#sold-listings">Sold listings</a>

          <button
            type="button"
            className="profile-logout"
            onClick={handleLogout}
          >
            Log out
          </button>
        </aside>

        {/* MAIN CONTENT */}
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

          {loading ? (
            <p>Loading your profile...</p>
          ) : (
            <>
              {/* PROFILE INFORMATION */}
              <section id="your-profile" className="profile-section">
                <div className="profile-user">
                  <div className="profile-avatar">{initials}</div>

                  <div>
                    <h2>{name || "Your profile"}</h2>

                    <p>{user?.campus || "Campus not available"}</p>

                    <span className="profile-verified">
                      {user?.emailVerified
                        ? "Campus email verified"
                        : "Email not verified"}
                    </span>
                  </div>
                </div>

                <form onSubmit={saveProfile} className="profile-form">
                  <div className="profile-form-grid">
                    <div className="profile-field">
                      <label htmlFor="displayName">Display name</label>

                      <input
                        id="displayName"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        maxLength={100}
                        required
                      />
                    </div>

                    <div className="profile-field">
                      <label htmlFor="campus">Campus</label>

                      <input id="campus" value={user?.campus || ""} readOnly />
                    </div>

                    <div className="profile-field">
                      <label htmlFor="email">Campus email</label>

                      <input id="email" value={user?.email || ""} readOnly />

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
                        onChange={(event) => setBio(event.target.value)}
                        maxLength={300}
                        rows={2}
                        placeholder="Keeping good finds on campus."
                      />

                      <small>Shown on your public profile.</small>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="profile-save-button"
                    disabled={!onSaveProfile || pending}
                  >
                    {pending ? "Please wait..." : "Save changes"}
                  </button>
                </form>
              </section>

              {/* ACCOUNT SECURITY */}
              <section id="account-security" className="profile-security">
                <div>
                  <h2>Account security</h2>

                  <p>Request an email link to reset your password.</p>
                </div>

                <button
                  type="button"
                  onClick={resetPassword}
                  disabled={!onResetPassword || pending}
                >
                  Reset password
                </button>
              </section>

              {/* ACTIVE LISTINGS */}
              <section id="my-listings" className="profile-section">
                <div className="profile-section-heading">
                  <h2>Active listings</h2>

                  <Link to="/list-an-item">+ List an item</Link>
                </div>

                <ListingCards
                  items={activeListings}
                  pending={pending}
                  onMarkSold={(id) => changeListingStatus(id, true)}
                />
              </section>

              {/* SOLD LISTINGS */}
              <section id="sold-listings" className="profile-section">
                <h2>Sold listings</h2>

                <p className="profile-section-description">
                  Items you've sold on campus.
                </p>

                <ListingCards
                  items={soldListings}
                  pending={pending}
                  onRelist={(id) => changeListingStatus(id, false)}
                />
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default Profile;
