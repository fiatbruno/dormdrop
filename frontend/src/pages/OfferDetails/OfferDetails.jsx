
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getOffer } from "../../api/offersApi";
import { getListingById } from "../../api/marketplaceApi";
import Footer from "../../components/Footer/Footer";
import Navbar from "../../components/Navbar/Navbar";
import OfferNegotiation from "../../components/OfferNegotiation/OfferNegotiation";
import useAuth from "../../hooks/useAuth";
import "./OfferDetails.css";

function userIdFromToken(token) {
  try {
    const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(encoded));
    const id = payload.id ?? payload.sub;
    return id == null ? null : String(id);
  } catch {
    return null;
  }
}

export default function OfferDetails() {
  const { offerId } = useParams();

  return <OfferDetailsContent key={offerId} offerId={offerId} />;
}

function OfferDetailsContent({ offerId }) {
  const { token } = useAuth();
  const [offer, setOffer] = useState(null);
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    getOffer(offerId)
      .then(async (currentOffer) => {
        let currentListing = null;

        try {
          currentListing = await getListingById(currentOffer.listingId);
        } catch {
          currentListing = null;
        }

        if (active) {
          setOffer(currentOffer);
          setListing(currentListing);
          setError("");
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.status === 401
              ? "Please sign in to view this negotiation."
              : "This negotiation is unavailable or you do not have access.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [offerId, attempt]);

  useEffect(() => {
    const onOfferNotice = (event) => {
      if (String(event.detail?.offerId || "") === String(offerId)) {
        setAttempt((value) => value + 1);
      }
    };

    const onReconnect = () => {
      setAttempt((value) => value + 1);
    };

    window.addEventListener(
      "dormdrop:notification-received",
      onOfferNotice,
    );

    window.addEventListener(
      "dormdrop:notifications-reconnected",
      onReconnect,
    );

    return () => {
      window.removeEventListener(
        "dormdrop:notification-received",
        onOfferNotice,
      );

      window.removeEventListener(
        "dormdrop:notifications-reconnected",
        onReconnect,
      );
    };
  }, [offerId]);

  async function handleOfferUpdated(updatedOffer) {
    if (updatedOffer) {
      setOffer(updatedOffer);
    }

    try {
      const latestOffer = await getOffer(offerId);
      setOffer(latestOffer);

      const latestListing = await getListingById(latestOffer.listingId);
      setListing(latestListing);
    } catch {
      setAttempt((value) => value + 1);
    }
  }

  const currentUserId = userIdFromToken(token);

  return (
    <div className="offer-details-shell">
      <Navbar showSearch={false} />

      <main className="offer-details-page">
        <Link to="/messages" className="offer-details-back">
          Back to messages
        </Link>

        <h1>Offer details</h1>

        {loading ? (
          <p role="status">Loading the latest offer…</p>
        ) : error ? (
          <div role="alert">
            <p>{error}</p>

            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError("");
                setAttempt((value) => value + 1);
              }}
            >
              Try again
            </button>
          </div>
        ) : offer ? (
          <>
            <p>Buyer: {offer.buyerDisplayName || "Unavailable"}</p>

            {!listing && (
              <p className="offer-details-unavailable">
                The listing is no longer available. You can review
                this negotiation, but actions that require an
                available listing may be unavailable.
              </p>
            )}

            {listing && (
              <section
                className="offer-details-listing"
                aria-label="Listing"
              >
                <div className="offer-details-listing-header">
                  <h2>{listing.title}</h2>

                  <span
                    className={`offer-details-listing-status is-${String(
                      listing.status || "unavailable",
                    ).toLowerCase()}`}
                  >
                    {String(
                      listing.status || "Unavailable",
                    ).replaceAll("_", " ")}
                  </span>
                </div>

                {listing.status === "AVAILABLE" && (
                  <p>This item is currently available.</p>
                )}

                {listing.status === "RESERVED" && (
                  <p>
                    This item is reserved for an accepted offer.
                    The buyer can confirm receipt after pickup.
                  </p>
                )}

                {listing.status === "SOLD" && (
                  <p>
                    This item has been marked as sold.
                  </p>
                )}

                {!["AVAILABLE", "RESERVED", "SOLD"].includes(
                  String(listing.status || "").toUpperCase(),
                ) && (
                  <p>
                    Listing status:{" "}
                    {String(
                      listing.status || "Unavailable",
                    ).toLowerCase()}
                  </p>
                )}
              </section>
            )}

            <OfferNegotiation
              offer={offer}
              listing={listing}
              currentUserId={currentUserId}
              participant={
                String(currentUserId) === String(offer.sellerId)
                  ? {
                      id: offer.buyerId,
                      name: offer.buyerDisplayName,
                    }
                  : undefined
              }
              onOfferUpdated={handleOfferUpdated}
            />
          </>
        ) : null}
      </main>

      <Footer />
    </div>
  );
}
