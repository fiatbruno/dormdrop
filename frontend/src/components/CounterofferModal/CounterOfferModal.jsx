
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { sendCounteroffer } from "../../api/offersApi";
import ListingImage from "../ListingImage";
import "./CounterofferModal.css";

const formatMoney = (amount) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);

export default function CounterofferModal({
  offer,
  listing,
  onClose,
  onSuccess,
}) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setAmount("");
    setError("");
  }, [offer?.id, listing?.id]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape" && !submitting) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, submitting]);

  if (!offer || !listing) return null;

  const buyerAmount = Number(offer.amount);
  const askingPrice = Number(listing.price);
  const counterAmount = Number(amount);

const validAmount =
  amount.trim() !== "" &&
  /^\d+(\.\d{1,2})?$/.test(amount) &&
  Number.isFinite(counterAmount) &&
  counterAmount > 0 &&
  counterAmount !== buyerAmount;
  const canSubmit =
    Number.isFinite(buyerAmount) &&
    Number.isFinite(askingPrice) &&
    validAmount &&
    !submitting;

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canSubmit) return;

    setSubmitting(true);
    setError("");

    try {
      const result = await sendCounteroffer(
        offer.id,
        counterAmount
      );

      onSuccess?.(result);
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not send your counteroffer. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="counteroffer-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <section
        className="counteroffer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="counteroffer-title"
      >
        <button
          type="button"
          className="counteroffer-close"
          aria-label="Close counteroffer"
          onClick={onClose}
          disabled={submitting}
        >
          <X size={22} />
        </button>

        <h2 id="counteroffer-title">
          Send a counteroffer
        </h2>

        <p className="counteroffer-subtitle">
          {offer.buyerName
            ? `${offer.buyerName}'s offer`
            : "Buyer's offer"}
          : {formatMoney(buyerAmount)} · Your asking price:{" "}
          {formatMoney(askingPrice)}
        </p>

        <div className="counteroffer-listing">
          <div className="counteroffer-image">
            <ListingImage
              src={listing.imageUrl}
              alt={listing.title}
              fallback={
                <div className="counteroffer-image-placeholder">
                  No photo
                </div>
              }
            />
          </div>

          <div className="counteroffer-listing-info">
            <h3>{listing.title}</h3>
            <p>
              Your listing · Asking{" "}
              {formatMoney(askingPrice)}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="counteroffer-amount"
            className="counteroffer-label"
          >
            Your offer
          </label>

          <div className="counteroffer-input-wrapper">
            <span aria-hidden="true">$</span>

            <input
              id="counteroffer-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setError("");
              }}
              required
              disabled={submitting}
              aria-describedby="counteroffer-help"
            />
          </div>

          <p
            id="counteroffer-help"
            className="counteroffer-help"
          >
            Buyer offered {formatMoney(buyerAmount)}.
            Enter a different price you would like to propose.
          </p>

          <div className="counteroffer-notice">
            <strong>
              The other person has 14 days to respond.
            </strong>
            <p>
              You can't edit an active offer. Sending a
              counteroffer replaces the previous offer.
            </p>
          </div>

          <p className="counteroffer-disclaimer">
            Agree on the final price in chat, then arrange
            an on-campus pickup. No payment is taken when
            you send an offer.
          </p>

          {error && (
            <p className="counteroffer-error" role="alert">
              {error}
            </p>
          )}

          <div className="counteroffer-actions">
            <button
              type="button"
              className="counteroffer-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="counteroffer-submit"
              disabled={!canSubmit}
            >
              {submitting
                ? "Sending..."
                : "Send counteroffer"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
