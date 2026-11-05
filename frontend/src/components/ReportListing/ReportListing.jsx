import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { submitListingReport } from "../../api/reportsApi";
import ListingImage from "../ListingImage";
import "./ReportListing.css";

const REASONS = [
  ["SUSPECTED_SCAM", "Scam or fraud"],
  ["PROHIBITED_ITEM", "Prohibited item"],
  ["MISLEADING_INFORMATION", "Misleading details"],
  ["INAPPROPRIATE_CONTENT", "Inappropriate content"],
  ["OTHER", "Other"],
];

function money(value) {
  if (
    value == null ||
    !Number.isFinite(Number(value))
  ) {
    return "Price unavailable";
  }
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function errorMessage(error) {
  const status = error.response?.status;
  if (status === 404) {
    return "This listing is no longer available to report.";
  }
  if (status === 409) {
    return (
      error.response?.data?.message ||
      "You have already reported this listing."
    );
  }
  if (status === 429) {
    return "You've reached the reporting limit. Please try again later.";
  }
  if ([401, 403].includes(status)) {
    return "You can't submit this report right now. Please sign in with a verified account and try again.";
  }
  if (status === 400 || status === 422) {
    return (
      error.response?.data?.message ||
      "Check the selected reason and report details, then try again."
    );
  }
  return (
    error.response?.data?.message ||
    "Couldn't submit your report. Please try again."
  );
}

export default function ReportListing({ listing, onClose }) {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const confirmationHeadingRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const submittingRef = useRef(false);
  const requestKeyRef = useRef(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (receipt) confirmationHeadingRef.current?.focus();
  }, [receipt]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    cancelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape" && !submittingRef.current) {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      const focusable = dialog?.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]',
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

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const trimmedDescription = description.trim();
    if (!category && !trimmedDescription) {
      setError("Choose a reason and tell us what happened before submitting.");
      return;
    }
    if (!category) {
      setError("Choose a reason for your report.");
      return;
    }
    if (!trimmedDescription) {
      setError("Tell us what happened so our team can review it.");
      return;
    }

    setSubmitting(true);
    submittingRef.current = true;
    setError("");
    try {
      requestKeyRef.current ||= globalThis.crypto.randomUUID();
      const result = await submitListingReport(
        listing.id,
        { category, description: trimmedDescription },
        requestKeyRef.current,
      );
      setReceipt(result);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }

  return (
    <div
      className="report-listing-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={`report-listing-dialog${receipt ? " is-confirmation" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-listing-title"
        aria-describedby="report-listing-dialog-description"
      >
        {!receipt ? (
          <>
            <header className="report-listing-dialog__header">
              <h2 id="report-listing-title">Report this listing</h2>
            </header>
            <p
              id="report-listing-dialog-description"
              className="report-listing-dialog__intro"
            >
              Help keep your campus marketplace safe. Choose the issue and add
              enough detail for a review.
            </p>

            <div className="report-listing-item">
              <div className="report-listing-item__image">
                <ListingImage
                  src={listing.image}
                  alt={listing.title}
                  fallback={<span aria-hidden="true">No photo</span>}
                />
              </div>
              <div className="report-listing-item__details">
                <strong>{listing.title}</strong>
                <span>
                  {listing.listingType === "Free / Donate"
                    ? "Free"
                    : money(listing.price)}
                  {listing.sellerName ? ` · ${listing.sellerName}` : ""}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="report-listing-field">
                <label htmlFor="report-listing-reason">Reason *</label>
                <select
                  id="report-listing-reason"
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value);
                    setError("");
                    requestKeyRef.current = globalThis.crypto.randomUUID();
                  }}
                  disabled={submitting}
                >
                  <option value="">Choose a reason</option>
                  {REASONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <p className="report-listing-field__hint">
                  Other options: prohibited item, misleading details, spam,
                  harassment, or other.
                </p>
              </div>

              <div className="report-listing-field">
                <label htmlFor="report-listing-details">
                  What happened? *
                </label>
                <textarea
                  id="report-listing-details"
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                    setError("");
                    requestKeyRef.current = globalThis.crypto.randomUUID();
                  }}
                  maxLength={2000}
                  rows={4}
                  disabled={submitting}
                />
                <span className="report-listing-field__count">
                  {description.length}/2000
                </span>
              </div>

              <div className="report-listing-privacy">
                <ShieldCheck size={18} aria-hidden="true" />
                <div>
                  <strong>Your identity stays private</strong>
                  <p>The seller won’t see who submitted the report.</p>
                </div>
              </div>

              {error && (
                <p className="report-listing-error" role="alert">
                  {error}
                </p>
              )}

              <div className="report-listing-actions">
                <button
                  ref={cancelRef}
                  type="button"
                  className="report-listing-actions__cancel"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="report-listing-actions__submit"
                  disabled={submitting}
                >
                  {submitting ? "Submitting…" : "Submit report"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="report-listing-confirmation">
            <span className="report-listing-confirmation__badge">
              Report submitted
            </span>
            <h2
              ref={confirmationHeadingRef}
              id="report-listing-title"
              tabIndex={-1}
            >
              Thanks for speaking up.
            </h2>
            <p id="report-listing-dialog-description">
              Your report is in the moderation queue. We’ll notify you after it
              has been reviewed.
            </p>
            <p className="report-listing-confirmation__reference">
              Reference {receipt.referenceNumber || receipt.reportId} ·{" "}
              {listing.title}
            </p>
            <p className="report-listing-policy">
              Reporting a listing does not automatically remove it.
            </p>
            <Link
              className="report-listing-confirmation__button"
              to={`/items/${encodeURIComponent(listing.id)}`}
              onClick={onClose}
            >
              Back to listing
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
