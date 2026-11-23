import { useEffect, useRef, useState } from "react";
import Button from "../Button/Button";
import ExchangeDialog from "./ExchangeDialog";
import {
  confirmItemReceived,
  getCompletedTransaction,
  getSellerReviews,
  submitSellerReview,
} from "../../api/offersApi";
import { campusNow } from "../../schemas/pickupSchema";

const stacked = "exchange-dialog__actions exchange-dialog__actions--stacked";
const actions = "exchange-dialog__actions";
const primary = "exchange-primary";

export default function ExchangeFlow({ offerId, isBuyer, pickup, pickupLabel, itemTitle, price, partner, onClose, onComplete }) {
  const [step, setStep] = useState("summary");
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(Boolean(offerId));
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [reviews, setReviews] = useState([]);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!offerId) return;
    let active = true;
    getCompletedTransaction(offerId)
      .then((result) => { if (active) setRecord(result); })
      .catch(() => { if (active) setLoadFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [offerId]);

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

  let title = "Your exchange";
  let badge;
  let content;
  const canReview = isBuyer && record && !record.sellerReview;
  const pickupPassed = pickup?.status === "ACCEPTED" && typeof pickup.timePickUp === "string" &&
    pickup.timePickUp.slice(0, 16) <= campusNow();

  if (step === "receipt") {
    title = "Did you receive the item?";
    content = <>
      <p>{itemTitle}{price && ` · Agreed price ${price}`}</p>
      <div className="exchange-dialog__callout">
        <strong>Confirm after inspecting the item</strong>
        <p>This marks the exchange as complete and the listing as sold.</p>
      </div>
      <div className={actions}>
        <Button type="button" disabled={busy} onClick={() => go("summary")}>Cancel</Button>
        <Button type="button" className={primary} disabled={busy} onClick={() => void run(async () => {
          setRecord(await confirmItemReceived(offerId));
          onComplete();
          go("completed");
        }, "Could not confirm receipt. Check the pickup time and try again.")}>
          {busy ? "Confirming…" : "Yes, I received it"}
        </Button>
      </div>
    </>;
  } else if (step === "completed") {
    title = "Exchange completed";
    badge = "Completed";
    content = <>
      <p>Your receipt confirmation has been recorded.</p>
      <div className={stacked}>
        {canReview && <Button type="button" className={primary} onClick={() => go("review")}>Rate the seller</Button>}
        <Button type="button" onClick={() => go("summary")}>Back to exchange</Button>
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
      <p>Your review helps other students decide who to buy from.</p>
      <fieldset className="exchange-rating" disabled={busy}>
        <legend>Your rating</legend>
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
      <div className={actions}>
        <Button type="button" disabled={busy} onClick={() => go("summary")}>Cancel</Button>
        <Button type="submit" className={primary} disabled={busy}>{busy ? "Submitting…" : "Submit review"}</Button>
      </div>
    </form>;
  } else if (step === "submitted") {
    title = "Thanks for your review";
    badge = "Submitted";
    content = <>
      <p>Your feedback has been saved.</p>
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
      <div className={stacked}><Button type="button" className={primary} onClick={() => go("summary")}>Back to exchange</Button></div>
    </>;
  } else {
    content = <>
      <p>{itemTitle}{price && ` · Agreed price ${price}`}</p>
      {pickup && <div className="exchange-dialog__callout">
        <strong>{pickup.status === "ACCEPTED" ? "Pickup confirmed" : pickup.status === "REJECTED" ? "Pickup declined" : "Pickup proposed"}</strong>
        <p>{pickup.meetingPlace} · {pickupLabel}</p>
      </div>}
      {loading && <p role="status">Checking exchange status…</p>}
      {loadFailed && <p role="alert">Could not load exchange status. Close and reopen to try again.</p>}
      {record && <p>Exchange completed{record.sellerReview ? " · Review submitted" : ""}</p>}
      {!record && !loading && !loadFailed && offerId && isBuyer && pickup?.status === "ACCEPTED" && !pickupPassed &&
        <p>You can confirm receipt after the scheduled pickup time.</p>}
      <div className={stacked}>
        {!loading && !loadFailed && !record && offerId && isBuyer && pickupPassed &&
          <Button type="button" className={primary} onClick={() => go("receipt")}>Confirm item received</Button>}
        {canReview && <Button type="button" className={primary} onClick={() => go("review")}>Rate the seller</Button>}
        {record && <Button type="button" disabled={busy} onClick={showReviews}>View seller reviews</Button>}
        <Button type="button" disabled={busy} onClick={onClose}>Back to conversation</Button>
      </div>
    </>;
  }

  return <ExchangeDialog title={title} badge={badge} busy={busy} onClose={onClose}>
    {content}
    {error && <p className="exchange-error" role="alert">{error}</p>}
  </ExchangeDialog>;
}
