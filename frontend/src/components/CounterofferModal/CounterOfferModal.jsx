
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { sendCounteroffer } from "../../api/offersApi";
import ListingImage from "../ListingImage";
import "./CounterofferModal.css";

const formatMoney = (amount) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

function getSuggestedAmount(offer, listing) {
  const buyerAmount = Number(offer?.amount);
  const askingPrice = Number(listing?.price);

  if (
    !Number.isFinite(buyerAmount) ||
    !Number.isFinite(askingPrice) ||
    askingPrice <= 0
  ) {
    return "";
  }

  const suggestion =
    buyerAmount < askingPrice
      ? Math.round(((buyerAmount + askingPrice) / 2) * 100) / 100
      : askingPrice;

  return suggestion > 0 && suggestion !== buyerAmount
    ? suggestion.toFixed(2)
    : "";
}

export default function CounterofferModal({
  offer,
  listing,
  proposerName,
  proposalLabel,
  expectedVersion,
  onClose,
  onSuccess,
  onConflict,
}) {
  const [amount, setAmount] = useState(() =>
    getSuggestedAmount(offer, listing),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const previousFocus = useRef(null);
  const requestKey = useRef(null);

  useEffect(() => {
    previousFocus.current = document.activeElement;
    inputRef.current?.focus();
    return () => {
      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus();
      }
    };
  }, []);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape" && !submitting) {
        onClose();
        return;
      }

      if (event.key === "Tab") {
        const dialog = document.querySelector(".counteroffer-modal");
        const focusable = dialog?.querySelectorAll(
          'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
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
  const counterpartyName = proposerName || "The other person";

  const validAmount =
    amount.trim() !== "" &&
    /^\d+(\.\d{1,2})?$/.test(amount) &&
    Number.isFinite(counterAmount) &&
    counterAmount > 0 &&
    counterAmount <= askingPrice &&
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
        counterAmount,
        expectedVersion,
        requestKey.current ||
          (requestKey.current = globalThis.crypto.randomUUID()),
      );

      requestKey.current = null;
      await onSuccess?.(result);
      onClose();
    } catch (err) {
      if (err.response?.status === 409) {
        await onConflict?.();
        onClose();
      } else {
        setError(
          err.response?.data?.message ||
            "Could not send your counteroffer. Please try again.",
        );
      }
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
          {proposalLabel || `${counterpartyName}'s proposal`}
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
              ref={inputRef}
              id="counteroffer-amount"
              type="number"
              min="0.01"
              max={askingPrice}
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
            {counterpartyName || "Buyer"} offered{" "}
            {formatMoney(buyerAmount)}. Enter your counter price, up to{" "}
            {formatMoney(askingPrice)}.
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
