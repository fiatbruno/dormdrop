
import { useEffect, useState } from "react";
import {
  Link,
  useParams,
} from "react-router-dom";

import {
  ArrowLeft,
  CheckCircle,
  XCircle,
} from "lucide-react";

import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import Button from "../../components/Button/Button";
import useAuth from "../../hooks/useAuth";

import {
  getOfferById,
  acceptOffer,
  rejectOffer,
} from "../../api/offerApi";

import "./OfferDetails.css";

function formatMoney(amount) {
  if (amount === null || amount === undefined) {
    return "Not available";
  }

  const number = Number(amount);

  if (!Number.isFinite(number)) {
    return "Not available";
  }

  return number.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function getCurrentUserId(token) {
  if (!token) return null;

  try {
    const payload = JSON.parse(
      atob(
        token.split(".")[1]
          .replace(/-/g, "+")
          .replace(/_/g, "/")
      )
    );

    return payload.id || null;
  } catch {
    return null;
  }
}

function getErrorMessage(error) {
  const status = error.response?.status;

  if (status === 401) {
    return "Please log in again.";
  }

  if (status === 403) {
    return "You do not have permission to manage this offer.";
  }

  if (status === 404) {
    return "This offer could not be found.";
  }

  if (status === 409) {
    return "This offer has already been processed or is no longer available.";
  }

  return (
    error.response?.data?.message ||
    "Something went wrong. Please try again."
  );
}

function OfferDetailsContent({ offerId }) {
  const { token } = useAuth();
  const currentUserId = getCurrentUserId(token);

  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    async function loadOffer() {
      setLoading(true);
      setError("");
      setOffer(null);

      try {
        const data = await getOfferById(offerId);

        if (!active) return;

        if (!data || typeof data !== "object") {
          throw new Error("Invalid offer response.");
        }

        setOffer(data);
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

    loadOffer();

    return () => {
      active = false;
    };
  }, [offerId]);

  async function handleDecision(decision) {
    if (saving || offer?.status !== "PENDING") {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (decision === "accept") {
        await acceptOffer(offerId);
      } else {
        await rejectOffer(offerId);
      }

      // Fetch the authoritative updated state.
      const updatedOffer = await getOfferById(offerId);

      setOffer(updatedOffer);

      setSuccess(
        decision === "accept"
          ? "You accepted the buyer's offer."
          : "You rejected the buyer's offer."
      );
    } catch (err) {
      setError(getErrorMessage(err));

      // A decision may have succeeded even if the
      // follow-up fetch failed. Avoid blind retries.
      try {
        const latest = await getOfferById(offerId);
        setOffer(latest);
      } catch {
        // Keep the existing offer until it can be reloaded.
      }
    } finally {
      setSaving(false);
    }
  }

  const isSeller =
    offer &&
    currentUserId !== null &&
    String(offer.sellerId) === String(currentUserId);

  const isPending = offer?.status === "PENDING";

  return (
    <div className="offer-details-shell">
      <Navbar showSearch={false} />

      <main className="offer-details-main">
        <Link to="/profile" className="offer-back-link">
          <ArrowLeft size={17} />
          Back to profile
        </Link>

        <div className="offer-details-card">
          <h1>Offer details</h1>

          {loading ? (
            <p role="status">Loading offer...</p>
          ) : !offer ? (
            <div role="alert">
              <p>{error || "Unable to load this offer."}</p>
            </div>
          ) : (
            <>
              {error && (
                <p className="offer-details-error" role="alert">
                  {error}
                </p>
              )}

              {success && (
                <p className="offer-details-success" role="status">
                  {success}
                </p>
              )}

              <div className="offer-details-row">
                <span>Listing</span>
                <strong>
                  {offer.listingTitle || "Not available"}
                </strong>
              </div>

              <div className="offer-details-row">
                <span>Buyer</span>
                <strong>
                  {offer.buyerName || "Not available"}
                </strong>
              </div>

              <div className="offer-details-row">
                <span>Listed price</span>
                <strong>
                  {formatMoney(offer.listingPrice)}
                </strong>
              </div>

              <div className="offer-details-row">
                <span>Offer amount</span>
                <strong className="offer-details-amount">
                  {formatMoney(offer.amount)}
                </strong>
              </div>

              <div className="offer-details-row">
                <span>Status</span>
                <strong>
                  {offer.status || "Not available"}
                </strong>
              </div>

              <div className="offer-details-row">
                <span>Submitted</span>
                <strong>
                  {offer.createdAt &&
                  !Number.isNaN(
                    new Date(offer.createdAt).getTime()
                  )
                    ? new Date(offer.createdAt)
                        .toLocaleString()
                    : "Not available"}
                </strong>
              </div>

              {offer.listingId && (
                <Link
                  className="offer-view-listing"
                  to={`/items/${encodeURIComponent(
                    offer.listingId
                  )}`}
                >
                  View original listing
                </Link>
              )}

              {!isSeller && (
                <p className="offer-details-muted">
                  Only the listing's seller can make
                  a decision on this offer.
                </p>
              )}

              {isSeller && isPending && (
                <div className="offer-decision-actions">
                  <Button
                    type="button"
                    className="offer-accept-button"
                    disabled={saving}
                    onClick={() =>
                      handleDecision("accept")
                    }
                  >
                    <CheckCircle size={18} />
                    {saving ? "Processing..." : "Accept offer"}
                  </Button>

                  <Button
                    type="button"
                    className="offer-reject-button"
                    disabled={saving}
                    onClick={() =>
                      handleDecision("reject")
                    }
                  >
                    <XCircle size={18} />
                    Reject offer
                  </Button>
                </div>
              )}

              {isSeller && !isPending && (
                <p className="offer-details-muted">
                  This offer is no longer pending.
                </p>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function OfferDetails() {
  const { offerId } = useParams();

  return (
    <OfferDetailsContent
      key={offerId}
      offerId={offerId}
    />
  );
}
