import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import Button from "../Button/Button";
import ExchangeDialog from "./ExchangeDialog";
import {
  confirmItemReceived,
  getSellerReviews,
  submitSellerReview,
} from "../../api/offersApi";
import useReceiptStatus from "../../hooks/useReceiptStatus";
import "./ExchangeOverview.css";

const stacked = "exchange-dialog__actions exchange-dialog__actions--stacked";
const actions = "exchange-dialog__actions";
const primary = "exchange-primary";

export default function ExchangeFlow({ offerId, pickup, itemTitle, price, partner, onComplete, inConversation = false }) {
  const [step, setStep] = useState("summary");
  const [savedRecord, setRecord] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [reviews, setReviews] = useState([]);
  const inFlight = useRef(false);

  const pickupVersion = pickup ? `${pickup.id}:${pickup.status}:${pickup.timePickUp}` : undefined;
  const { status, error: loadFailed, loading, retry } = useReceiptStatus(offerId, pickupVersion);
  const record = savedRecord ?? status?.transaction;
  const isBuyer = status?.buyer === true;
  const canConfirmReceipt = status?.buyer === true && status.canConfirm === true && !record;

  function go(next) {
    setError("");
    setStep(next);
  }

  async function run(action, message) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (failure) {
      setError(failure.response?.data?.detail || failure.response?.data?.message || message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function showReviews() {
    void run(async () => {
      setReviews(await getSellerReviews(offerId));
      go("reviews");
    }, "Could not load seller reviews. Try again.");
  }

  let title;
  let badge;
  let content;
  const canReview = isBuyer && record && !record.sellerReview;
  const backLabel = inConversation ? "Back to messages" : "Back to exchange";

  if (step === "receipt" && !record) {
    title = "Did you receive the item?";
    content = <>
      <p>{itemTitle}{price && ` · Agreed price ${price}`}</p>
      <div className="exchange-dialog__callout">
        <strong>Confirm after inspecting the item</strong>
        <p>This records the exchange as completed and lets you review the seller.</p>
      </div>
      <div className={actions}>
        <Button type="button" disabled={busy} onClick={() => go("summary")}>Cancel</Button>
        <Button type="button" className={primary} disabled={busy || !canConfirmReceipt} onClick={() => void run(async () => {
          setRecord(await confirmItemReceived(offerId));
          onComplete?.();
          go("completed");
        }, "Could not confirm receipt. Check the pickup time and try again.")}>
          {busy ? "Confirming…" : "Yes, received"}
        </Button>
      </div>
    </>;
  } else if (step === "completed" || (step === "receipt" && record)) {
    title = "Exchange completed";
    badge = "Completed";
    content = <>
      <p>Your receipt confirmation has been recorded. Share your experience to help other campus buyers.</p>
      <div className={stacked}>
        {canReview && <Button type="button" className={primary} onClick={() => go("review")}>Rate the seller</Button>}
        <Button type="button" onClick={() => go("summary")}>{backLabel}</Button>
      </div>
    </>;
  } else if (step === "review") {
    title = "How was your exchange?";
    content = <form noValidate onSubmit={(event) => {
      event.preventDefault();
      if (!rating) { setError("Choose a star rating before submitting."); return; }
      void run(async () => {
        setRecord(await submitSellerReview(offerId, { rating, comment: comment.trim() }));
        go("submitted");
      }, "Could not submit your review. Try again.");
    }}>
      <p>{partner ? `Share your experience with ${partner}.` : "Your review helps other students decide who to buy from."}</p>
      <fieldset className="exchange-rating" disabled={busy}>
        <legend>Your rating <span aria-hidden="true">*</span></legend>
        {[1, 2, 3, 4, 5].map((value) => (
          <label key={value}>
            <input type="radio" name="seller-rating" value={value} checked={rating === value} onChange={() => setRating(value)} aria-label={`${value} ${value === 1 ? "star" : "stars"}`} />
            <span aria-hidden="true">{value <= rating ? "★" : "☆"}</span>
          </label>
        ))}
      </fieldset>
      <label className="exchange-review-field">
        Your review (optional)
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} rows={3} disabled={busy} />
      </label>
      <p className="exchange-review-hint">Share details about the exchange.</p>
      <div className={actions}>
        <Button type="button" disabled={busy} onClick={() => go("summary")}>Cancel</Button>
        <Button type="submit" className={primary} disabled={busy}>{busy ? "Submitting…" : "Submit review"}</Button>
      </div>
    </form>;
  } else if (step === "submitted") {
    title = "Thanks for your review";
    badge = "Submitted";
    content = <>
      <p>Your feedback helps other members shop with confidence.</p>
      <div className={stacked}>
        <Button type="button" className={primary} disabled={busy} onClick={showReviews}>View seller reviews</Button>
      </div>
    </>;
  } else if (step === "reviews") {
    title = isBuyer && partner ? `Reviews for ${partner}` : "Seller reviews";
    content = <>
      {reviews.length === 0 && <p>No reviews yet.</p>}
      <ul className="exchange-reviews">
        {reviews.map((review, index) => <li key={`${review.submittedAt}-${index}`}>
          <strong>{review.rating} out of 5 stars</strong>
          {review.comment && <p>{review.comment}</p>}
        </li>)}
      </ul>
      <div className={stacked}><Button type="button" className={primary} onClick={() => go("summary")}>{backLabel}</Button></div>
    </>;
  }

  const receiptButton = canConfirmReceipt && (
    <Button type="button" className={primary} aria-haspopup="dialog" onClick={() => go("receipt")}>
      Confirm item received
    </Button>
  );
  const completedBadge = record && <span className="exchange-overview__badge">Completed</span>;
  const dialog = title && (
    <ExchangeDialog title={title} badge={badge} busy={busy} onClose={() => go("summary")}>
      {content}
      {error && <p className="exchange-error" role="alert">{error}</p>}
    </ExchangeDialog>
  );

  if (inConversation) {
    return <>
      {receiptButton}
      {completedBadge}
      {dialog && createPortal(dialog, document.body)}
    </>;
  }

  return (
    <section className="exchange-overview__card" aria-label="Complete your exchange">
      <div className="exchange-overview__card-header">
        <h2>Complete your exchange</h2>
        {completedBadge}
      </div>
      {!record && (
        <ol className="exchange-overview__steps">
          <li>Seller accepts the pickup time</li>
          <li>Meet and inspect</li>
          <li>Confirm receipt</li>
        </ol>
      )}
      {loading && <p role="status">Checking exchange status…</p>}
      {loadFailed && !record && <p role="alert">Could not load exchange status. <button type="button" onClick={retry}>Try again</button></p>}
      {record?.sellerReview && <p>Review submitted</p>}
      {!record && !loading && !loadFailed && (
        <p>{status?.buyer === false
          ? "The exchange stays open until the buyer confirms receipt after pickup."
          : status?.waitingForPickupTime
          ? "You can confirm receipt after the scheduled pickup time."
          : canConfirmReceipt
            ? "Confirm receipt after you’ve collected and inspected the item."
            : "Propose a pickup time for the seller to accept. You can confirm receipt once that time has passed."}</p>
      )}
      <div className="exchange-overview__actions">
        {receiptButton}
        {canReview && <Button type="button" className={primary} onClick={() => go("review")}>Rate the seller</Button>}
        {record && <Button type="button" disabled={busy} onClick={showReviews}>View seller reviews</Button>}
      </div>
      {dialog}
      {!dialog && error && <p role="alert">{error}</p>}
    </section>
  );
}
