import { startConversation } from "../../api/messagingApi";
import useAuth from "../../hooks/useAuth";
import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ImageOff, UserRound } from "lucide-react";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import ListingImage from "../../components/ListingImage";
import ProductCard from "../../components/ProductCard/ProductCard";
import {
  getListingById,
  getListings,
  getFavorites,
  addFavorite,
  removeFavorite,
} from "../../api/marketplaceApi";
import "./ItemDetails.css";

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

export default function ItemDetails() {
  const { id } = useParams();
  return <ItemDetailsContent key={id} id={id} />;
}

function ItemDetailsContent({ id }) {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [contactPending, setContactPending] = useState(false);
  let currentUserId = null;
  try {
    currentUserId = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    ).id;
  } catch {
  }
  async function contactSeller() {
    if (contactPending) return;
    setContactPending(true);
    setActionError("");
    try {
      const conversation = await startConversation(id);
      navigate(`/messages/${conversation.id}`);
    } catch (err) {
      setActionError(
        err.response?.status === 409
          ? "This listing has no seller to contact."
          : "Could not start the conversation. Please try again.",
      );
    } finally {
      setContactPending(false);
    }
  }

  const [listing, setListing] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState(false);
  const [favoritesReady, setFavoritesReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [favoriteAttempt, setFavoriteAttempt] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getListingById(id)
      .then((item) => {
        if (!cancelled) setListing(item);
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            [400, 404].includes(err.response?.status)
              ? "This listing is no longer available or the link is invalid."
              : "Couldn't load this listing. Please try again.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  useEffect(() => {
    let cancelled = false;
    getListings()
      .then((items) => {
        if (!cancelled) setRelated(items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setFavoritesReady(false);
    setActionError("");
    getFavorites()
      .then((ids) => {
        if (!cancelled) {
          setSaved(ids.includes(id));
          setFavoritesReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setActionError("Couldn't load your saved status.");
      });
    return () => {
      cancelled = true;
    };
  }, [id, favoriteAttempt]);

  async function toggleSave() {
    if (pending || !favoritesReady) return;
    setPending(true);
    setActionError("");
    try {
      await (saved ? removeFavorite(id) : addFavorite(id));
      setSaved(!saved);
    } catch {
      setActionError("Couldn't update your saved items. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(
        new URL(`/items/${encodeURIComponent(id)}`, window.location.origin)
          .href,
      );
      setShareMessage("Listing link copied!");
    } catch {
      setShareMessage(
        "Couldn't copy the link. Copy this page's address to share it.",
      );
    }
  }

  const recommendations = listing
    ? related
        .filter((item) => item.id !== id && item.status === "AVAILABLE")
        .sort(
          (a, b) =>
            Number(b.category === listing.category) -
            Number(a.category === listing.category),
        )
        .slice(0, 3)
    : [];
  const date = listing?.listedOn ? new Date(listing.listedOn) : null;
  const posted =
    date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        }).format(date)
      : "";

  return (
    <div className="item-shell">
      <Navbar showSearch={false} />
      <main className="item-page">
        <nav className="item-breadcrumbs" aria-label="Breadcrumb">
          <Link to="/home">Browse items</Link>
          {listing && (
            <>
              <span aria-hidden="true">/</span>
              <span>{listing.category}</span>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{listing.title}</span>
            </>
          )}
        </nav>
        {loading ? (
          <div className="item-state" role="status">
            Loading listing…
          </div>
        ) : error ? (
          <div className="item-state" role="alert">
            <h1>Listing unavailable</h1>
            <p>{error}</p>
            <button type="button" onClick={() => setAttempt(attempt + 1)}>
              Try again
            </button>
            <Link to="/home">Back to browse</Link>
          </div>
        ) : (
          listing && (
            <>
              <div className="item-layout">
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
                          <ImageOff size={40} aria-hidden="true" />
                          <span>Photo unavailable</span>
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
                <section className="item-summary" aria-labelledby="item-title">
                  <p className="item-eyebrow">{listing.category}</p>
                  <h1 id="item-title">{listing.title}</h1>
                  <p className="item-price">
                    {listing.listingType === "Free / Donate"
                      ? "Free"
                      : listing.listingType === "Trade"
                        ? "Trade"
                        : currency.format(listing.price)}
                  </p>
                  <span
                    className={`item-status ${listing.status === "AVAILABLE" ? "is-available" : ""}`}
                  >
                    {statuses[listing.status] || "Status unavailable"}
                  </span>
                  <p className="item-meta">
                    {[listing.condition, posted && `Posted ${posted}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="item-pickup">
                    <p className="item-eyebrow">Pickup area</p>
                    <h2>
                      {listing.pickupLocation || "Pickup area not specified"}
                    </h2>
                    <p className="item-muted">
                      Agree on a public meeting spot before pickup.
                    </p>
                  </div>
                  {currentUserId !==
                    (typeof listing.ownerId === "string"
                      ? listing.ownerId
                      : listing.ownerId?.$oid ||
                        listing.ownerId?.hexString) && (
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
                  <div className="item-actions">
                    <button
                      type="button"
                      onClick={toggleSave}
                      disabled={pending || !favoritesReady}
                      aria-pressed={saved}
                      aria-busy={pending}
                    >
                      {pending
                        ? "Updating…"
                        : saved
                          ? "Saved · Unsave item"
                          : "Save item"}
                    </button>
                    <button type="button" onClick={share}>
                      Share listing
                    </button>
                  </div>
                  {actionError && (
                    <p className="item-feedback" role="alert">
                      {actionError}{" "}
                      {!favoritesReady && (
                        <button
                          type="button"
                          onClick={() =>
                            setFavoriteAttempt(favoriteAttempt + 1)
                          }
                        >
                          Retry saved status
                        </button>
                      )}
                    </p>
                  )}
                  <p className="item-feedback" role="status">
                    {shareMessage}
                  </p>
                  <div className="item-seller">
                    <div className="item-seller-heading">
                      <span className="item-avatar">
                        <UserRound size={20} aria-hidden="true" />
                      </span>
                      <div>
                        <h2>{listing.sellerName || "Seller unavailable"}</h2>
                        <p className="item-muted">Verified Student</p>
                      </div>
                    </div>
                    <p>Ask about the item or arrange a pickup in messages.</p>
                  </div>
                  <p className="item-safety">
                    Meet on campus, in a public place. Inspect the item before
                    paying. Never share account or verification codes.
                  </p>
                </section>
                <section
                  className="item-about"
                  aria-labelledby="item-about-title"
                >
                  <h2 id="item-about-title">About this item</h2>
                  <p className="item-description">
                    {listing.description || "No description provided."}
                  </p>
                  <dl>
                    <div>
                      <dt>Condition</dt>
                      <dd>{listing.condition || "Not specified"}</dd>
                    </div>
                    <div>
                      <dt>Listing type</dt>
                      <dd>{listing.listingType}</dd>
                    </div>
                    <div>
                      <dt>Category</dt>
                      <dd>{listing.category || "Other"}</dd>
                    </div>
                  </dl>
                </section>
              </div>
              {recommendations.length > 0 && (
                <section
                  className="item-related"
                  aria-labelledby="item-related-title"
                >
                  <h2 id="item-related-title">More campus finds</h2>
                  <div className="item-related-grid">
                    {recommendations.map((item) => (
                      <ProductCard key={item.id} product={item} />
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
