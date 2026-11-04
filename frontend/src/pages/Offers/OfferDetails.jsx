
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
  if (amount == null || !Number.isFinite(Number(amount))) {
    return "Not available";
  }

  return Number(amount).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function getCurrentUserId(token) {
  if (!token) return null;

  try {
    const encoded = token.split(".")[1];
    const normalized = encoded
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const payload = JSON.parse(atob(normalized));
    return payload.id || null;
  } catch {
    return null;
  }
}

function getErrorMessage(error) {
  const status = error.response?.status;

  if (status === 401) return "Please log in again.";

  if (status === 403) {
    return "You do not have permission to manage this offer.";
  }

  if (status === 404) {
    return "This offer could not be found.";
  }

  if (status === 409) {
    return "This offer has changed. Its latest status has been loaded.";
  }

  return (
    error.response?.data?.message ||
    error.message ||
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
      setSuccess("");
      setOffer(null);

      try {
        const data = await getOfferById(offerId);

        if (!active) return;

        if (!data || typeof data !== "object") {
          throw new Error("Invalid offer response.");
        }

        setOffer(data);
      } catch (err) {
        if (active) setError(getErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadOffer();

    return () => {
      active = false;
    };
  }, [offerId]);

  async function handleDecision(decision) {
    if (saving || !offer) return;

    const isSeller =
      currentUserId != null &&
      String(currentUserId) === String(offer.sellerId);

    const canRespond =
      isSeller &&
      offer.status === "PENDING" &&
      String(currentUserId) !==
        String(offer.currentProposerId);

    if (!canRespond) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const updated =
        decision === "accept"
          ? await acceptOffer(offer.id, offer.version)
          : await rejectOffer(offer.id, offer.version);

      setOffer(updated);

      setSuccess(
        decision === "accept"
          ? "You accepted the buyer's offer."
          : "You rejected the buyer's offer."
      );
    } catch (err) {
      setError(getErrorMessage(err));

      try {
        const latest = await getOfferById(offerId);
        setOffer(latest);
      } catch {
        setError(
          "Could not confirm the latest offer status. Reload the page before trying again."
        );
      }
    } finally {
      setSaving(false);
    }
  }

  const isSeller =
    offer &&
    currentUserId != null &&
    String(currentUserId) === String(offer.sellerId);

  const isPending = offer?.status === "PENDING";

  const canRespond =
    isSeller &&
    isPending &&
    String(currentUserId) !==
      String(offer.currentProposerId);

  const isAccepted = offer?.status === "ACCEPTED";
  const isRejected = offer?.status === "REJECTED";

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
                  {offer.listingTitle || "Listing"}
                </strong>
              </div>

              <div className="offer-details-row">
                <span>Buyer</span>
                <strong>
                  {offer.buyerName || "Not available"}
                </strong>
              </div>

              {offer.listingPrice != null && (
                <div className="offer-details-row">
                  <span>Listed price</span>
                  <strong>
                    {formatMoney(offer.listingPrice)}
                  </strong>
                </div>
              )}

              <div className="offer-details-row">
                <span>Offer amount</span>
                <strong className="offer-details-amount">
                  {formatMoney(offer.amount)}
                </strong>
              </div>

              <div className="offer-details-row">
                <span>Status</span>
                <strong>
                  {isAccepted
                    ? "Accepted"
                    : isRejected
                      ? "Declined"
                      : isPending
                        ? "Pending"
                        : offer.status || "Not available"}
                </strong>
              </div>

              <div className="offer-details-row">
                <span>Submitted</span>
                <strong>
                  {offer.createdAt &&
                  !Number.isNaN(Date.parse(offer.createdAt))
                    ? new Date(offer.createdAt).toLocaleString()
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

              {isAccepted && (
                <p className="offer-details-success">
                  <CheckCircle size={18} />
                  Offer accepted. You can arrange pickup
                  through your conversation.
                </p>
              )}

              {isRejected && (
                <p className="offer-details-muted">
                  <XCircle size={18} />
                  This offer was declined and can no
                  longer be accepted.
                </p>
              )}

              {isSeller && canRespond && (
                <div className="offer-decision-actions">
                  <Button
                    type="button"
                    className="offer-accept-button"
                    disabled={saving}
                    onClick={() => handleDecision("accept")}
                  >
                    <CheckCircle size={18} />
                    {saving ? "Processing..." : "Accept offer"}
                  </Button>

                  <Button
                    type="button"
                    className="offer-reject-button"
                    disabled={saving}
                    onClick={() => handleDecision("reject")}
                  >
                    <XCircle size={18} />
                    Reject offer
                  </Button>
                </div>
              )}

              {isSeller && isPending && !canRespond && (
                <p className="offer-details-muted">
                  Waiting for the buyer to respond to
                  your counteroffer.
                </p>
              )}

              {!isSeller && isPending && (
                <p className="offer-details-muted">
                  Only the participant responding to the
                  current proposal can make a decision.
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
