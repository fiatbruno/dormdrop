
import { useEffect, useState } from "react";
import {
  Link,
  useParams,
  useNavigate,
} from "react-router-dom";

import {
  ImageOff,
  UserRound,
} from "lucide-react";

import { startConversation } from "../../api/messagingApi";
import useAuth from "../../hooks/useAuth";

import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import ListingImage from "../../components/ListingImage";
import ProductCard from "../../components/ProductCard/ProductCard";
import OfferForm from "../../components/OfferForm/OfferForm";

import {
  getListingById,
  getListings,
  getFavorites,
  addFavorite,
  removeFavorite,
} from "../../api/marketplaceApi";

import "./ItemDetails.css";

// ============================================
// FORMATTING
// ============================================

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const statuses = {
  AVAILABLE: "Available",
  RESERVED: "Reserved",
  SOLD: "Sold",
  DONATED: "Donated",
};

// ============================================
// HELPERS
// ============================================

function getCurrentUserId(token) {
  if (!token) return null;

  try {
    const payload = JSON.parse(
      atob(
        token
          .split(".")[1]
          .replace(/-/g, "+")
          .replace(/_/g, "/")
      )
    );

    return payload.id || null;
  } catch {
    return null;
  }
}

function getOwnerId(ownerId) {
  if (!ownerId) return null;

  if (typeof ownerId === "string") {
    return ownerId;
  }

  return ownerId.$oid || ownerId.hexString || null;
}

// ============================================
// MAIN PAGE
// ============================================

export default function ItemDetails() {
  const { id } = useParams();

  return (
    <ItemDetailsContent
      key={id}
      id={id}
    />
  );
}

// ============================================
// ITEM DETAILS CONTENT
// ============================================

function ItemDetailsContent({ id }) {
  const navigate = useNavigate();
  const { token } = useAuth();

  const currentUserId = getCurrentUserId(token);

  // Listing information
  const [listing, setListing] = useState(null);
  const [related, setRelated] = useState([]);

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  // Favorites
  const [saved, setSaved] = useState(false);
  const [favoritesReady, setFavoritesReady] =
    useState(false);
  const [pending, setPending] = useState(false);
  const [favoriteAttempt, setFavoriteAttempt] =
    useState(0);

  // Messaging
  const [contactPending, setContactPending] =
    useState(false);

  // Feedback
  const [actionError, setActionError] = useState("");
  const [shareMessage, setShareMessage] = useState("");

  // ==========================================
  // SCROLL TO TOP WHEN LISTING CHANGES
  // ==========================================

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  // ==========================================
  // FETCH LISTING DETAILS
  // ==========================================

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");
    setListing(null);

    getListingById(id)
      .then((item) => {
        if (!cancelled) {
          setListing(item);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            [400, 404].includes(err.response?.status)
              ? "This listing is no longer available or the link is invalid."
              : "Couldn't load this listing. Please try again."
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  // ==========================================
  // FETCH RELATED LISTINGS
  // ==========================================

  useEffect(() => {
    let cancelled = false;

    getListings()
      .then((items) => {
        if (!cancelled) {
          setRelated(items);
        }
      })
      .catch(() => {
        // Related listings are optional.
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  // ==========================================
  // FETCH FAVORITES
  // ==========================================

  useEffect(() => {
    let cancelled = false;

    setFavoritesReady(false);
    setActionError("");

    if (!token) {
      setSaved(false);
      setFavoritesReady(true);

      return () => {
        cancelled = true;
      };
    }

    getFavorites()
      .then((ids) => {
        if (!cancelled) {
          setSaved(ids.includes(id));
          setFavoritesReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActionError(
            "Couldn't load your saved status."
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, favoriteAttempt, token]);

  // ==========================================
  // CONTACT SELLER
  // ==========================================

  async function contactSeller() {
    if (contactPending) return;

    if (!token) {
      navigate("/login");
      return;
    }

    setContactPending(true);
    setActionError("");

    try {
      const conversation =
        await startConversation(id);

      navigate(`/messages/${conversation.id}`);
    } catch (err) {
      setActionError(
        err.response?.status === 409
          ? "This listing has no seller to contact."
          : "Could not start the conversation. Please try again."
      );
    } finally {
      setContactPending(false);
    }
  }

  // ==========================================
  // SAVE OR UNSAVE LISTING
  // ==========================================

  async function toggleSave() {
    if (!token) {
      navigate("/login");
      return;
    }

    if (pending || !favoritesReady) return;

    setPending(true);
    setActionError("");

    try {
      if (saved) {
        await removeFavorite(id);
      } else {
        await addFavorite(id);
      }

      setSaved((previous) => !previous);
    } catch {
      setActionError(
        "Couldn't update your saved items. Please try again."
      );
    } finally {
      setPending(false);
    }
  }

  // ==========================================
  // SHARE LISTING
  // ==========================================

  async function share() {
    try {
      const listingUrl = new URL(
        `/items/${encodeURIComponent(id)}`,
        window.location.origin
      ).href;

      await navigator.clipboard.writeText(listingUrl);

      setShareMessage("Listing link copied!");
    } catch {
      setShareMessage(
        "Couldn't copy the link. Copy this page's address to share it."
      );
    }
  }

  // ==========================================
  // DETERMINE LISTING OWNERSHIP
  // ==========================================

  const ownerId = getOwnerId(listing?.ownerId);

  const isOwner =
    currentUserId !== null &&
    ownerId !== null &&
    String(currentUserId) === String(ownerId);

  const canContactSeller =
    ownerId !== null && !isOwner;

  // ==========================================
  // NEW FEATURE: OFFER ELIGIBILITY
  // ==========================================

  const isAvailable =
    listing?.status === "AVAILABLE";

  const isMonetaryListing =
    listing?.listingType !== "Free / Donate" &&
    listing?.listingType !== "Trade" &&
    listing?.price !== null &&
    listing?.price !== undefined &&
    Number.isFinite(Number(listing?.price)) &&
    Number(listing?.price) > 0;

  const canMakeOffer =
    Boolean(token) &&
    currentUserId !== null &&
    ownerId !== null &&
    !isOwner &&
    isAvailable &&
    isMonetaryListing;

  // ==========================================
  // RELATED LISTING RECOMMENDATIONS
  // ==========================================

  const recommendations = listing
    ? related
        .filter(
          (item) =>
            item.id !== id &&
            item.status === "AVAILABLE"
        )
        .sort(
          (a, b) =>
            Number(
              b.category === listing.category
            ) -
            Number(
              a.category === listing.category
            )
        )
        .slice(0, 3)
    : [];

  // ==========================================
  // FORMAT LISTING DATE
  // ==========================================

  const date = listing?.listedOn
    ? new Date(listing.listedOn)
    : null;

  const posted =
    date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        }).format(date)
      : "";

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="item-shell">
      <Navbar showSearch={false} />

      <main className="item-page">
        {/* BREADCRUMB */}

        <nav
          className="item-breadcrumbs"
          aria-label="Breadcrumb"
        >
          <Link to="/home">
            Browse items
          </Link>

          {listing && (
            <>
              <span aria-hidden="true">
                /
              </span>

              <span>
                {listing.category}
              </span>

              <span aria-hidden="true">
                /
              </span>

              <span aria-current="page">
                {listing.title}
              </span>
            </>
          )}
        </nav>

        {/* LOADING */}

        {loading ? (
          <div
            className="item-state"
            role="status"
          >
            Loading listing…
          </div>
        ) : error ? (
          /* ERROR */

          <div
            className="item-state"
            role="alert"
          >
            <h1>Listing unavailable</h1>

            <p>{error}</p>

            <button
              type="button"
              onClick={() =>
                setAttempt((previous) => previous + 1)
              }
            >
              Try again
            </button>

            <Link to="/home">
              Back to browse
            </Link>
          </div>
        ) : (
          listing && (
            <>
              <div className="item-layout">

                {/* ========================= */}
                {/* LISTING PHOTO             */}
                {/* ========================= */}

                <section
                  className="item-photo-section"
                  aria-label="Seller photo"
                >
                  <div className="item-photo">
                    <ListingImage
                      src={listing.image}
                      alt={listing.title}
                      fallback={
                        <div className="item-photo-placeholder">
                          <ImageOff
                            size={40}
                            aria-hidden="true"
                          />

                          <span>
                            Photo unavailable
                          </span>
                        </div>
                      }
                    />
                  </div>

                  <p className="item-caption">
                    {listing.image
                      ? "Seller photo · 1 of 1"
                      : "No seller photo provided"}
                  </p>
                </section>

                {/* ========================= */}
                {/* LISTING SUMMARY           */}
                {/* ========================= */}

                <section
                  className="item-summary"
                  aria-labelledby="item-title"
                >
                  <p className="item-eyebrow">
                    {listing.category}
                  </p>

                  <h1 id="item-title">
                    {listing.title}
                  </h1>

                  <p className="item-price">
                    {listing.listingType === "Free / Donate"
                      ? "Free"
                      : listing.listingType === "Trade"
                        ? "Trade"
                        : currency.format(listing.price)}
                  </p>

                  <span
                    className={`item-status ${
                      isAvailable
                        ? "is-available"
                        : ""
                    }`}
                  >
                    {statuses[listing.status] ||
                      "Status unavailable"}
                  </span>

                  <p className="item-meta">
                    {[
                      listing.condition,
                      posted && `Posted ${posted}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>

                  {/* PICKUP INFORMATION */}

                  <div className="item-pickup">
                    <p className="item-eyebrow">
                      Pickup area
                    </p>

                    <h2>
                      {listing.pickupLocation ||
                        "Pickup area not specified"}
                    </h2>

                    <p className="item-muted">
                      Agree on a public meeting spot
                      before pickup.
                    </p>
                  </div>

                  {/* CONTACT SELLER */}

                  {canContactSeller && (
                    <button
                      className="item-primary"
                      type="button"
                      onClick={contactSeller}
                      disabled={contactPending}
                    >
                      {contactPending
                        ? "Opening conversation…"
                        : "Contact seller"}
                    </button>
                  )}

                  {/* ========================= */}
                  {/* NEW: MAKE AN OFFER       */}
                  {/* ========================= */}

                  {canMakeOffer && (
                    <OfferForm
                      key={listing.id}
                      listingId={listing.id}
                      listingPrice={listing.price}
                    />
                  )}

                  {/* SAVE AND SHARE */}

                  <div className="item-actions">
                    <button
                      type="button"
                      onClick={toggleSave}
                      disabled={
                        pending ||
                        (Boolean(token) &&
                          !favoritesReady)
                      }
                      aria-pressed={saved}
                      aria-busy={pending}
                    >
                      {pending
                        ? "Updating…"
                        : saved
                          ? "Saved · Unsave item"
                          : "Save item"}
                    </button>

                    <button
                      type="button"
                      onClick={share}
                    >
                      Share listing
                    </button>
                  </div>

                  {/* ACTION ERRORS */}

                  {actionError && (
                    <p
                      className="item-feedback"
                      role="alert"
                    >
                      {actionError}{" "}

                      {token &&
                        !favoritesReady && (
                          <button
                            type="button"
                            onClick={() =>
                              setFavoriteAttempt(
                                (previous) =>
                                  previous + 1
                              )
                            }
                          >
                            Retry saved status
                          </button>
                        )}
                    </p>
                  )}

                  {/* SHARE FEEDBACK */}

                  <p
                    className="item-feedback"
                    role="status"
                  >
                    {shareMessage}
                  </p>

                  {/* ========================= */}
                  {/* SELLER INFORMATION       */}
                  {/* ========================= */}

                  <div className="item-seller">
                    <div className="item-seller-heading">
                      <span className="item-avatar">
                        <UserRound
                          size={20}
                          aria-hidden="true"
                        />
                      </span>

                      <div>
                        <h2>
                          {listing.sellerName ||
                            "Seller unavailable"}
                        </h2>

                        <p className="item-muted">
                          Campus seller
                        </p>
                      </div>
                    </div>

                    <p>
                      Ask about the item or arrange
                      a pickup in messages.
                    </p>
                  </div>

                  {/* SAFETY MESSAGE */}

                  <p className="item-safety">
                    Meet on campus, in a public place.
                    Inspect the item before paying.
                    Never share account or verification
                    codes.
                  </p>
                </section>

                {/* ========================= */}
                {/* ABOUT THE ITEM            */}
                {/* ========================= */}

                <section
                  className="item-about"
                  aria-labelledby="item-about-title"
                >
                  <h2 id="item-about-title">
                    About this item
                  </h2>

                  <p className="item-description">
                    {listing.description ||
                      "No description provided."}
                  </p>

                  <dl>
                    <div>
                      <dt>Condition</dt>

                      <dd>
                        {listing.condition ||
                          "Not specified"}
                      </dd>
                    </div>

                    <div>
                      <dt>Listing type</dt>

                      <dd>
                        {listing.listingType ||
                          "Not specified"}
                      </dd>
                    </div>

                    <div>
                      <dt>Category</dt>

                      <dd>
                        {listing.category ||
                          "Not specified"}
                      </dd>
                    </div>
                  </dl>
                </section>
              </div>

              {/* ========================= */}
              {/* RELATED LISTINGS          */}
              {/* ========================= */}

              {recommendations.length > 0 && (
                <section
                  className="item-related"
                  aria-labelledby="item-related-title"
                >
                  <h2 id="item-related-title">
                    More campus finds
                  </h2>

                  <div className="item-related-grid">
                    {recommendations.map((item) => (
                      <ProductCard
                        key={item.id}
                        product={item}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )
        )}
      </main>

      <Footer />
    </div>
  );
}
