
import { useRef, useState } from "react";

import Button from "../Button/Button";
import {
  createOffer,
  newOfferRequestKey,
} from "../../api/offerApi";

import "./OfferForm.css";

export default function OfferForm({
  listingId,
  listingPrice,
  onOfferSubmitted,
}) {
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [openingConversation, setOpeningConversation] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submittingRef = useRef(false);
  const openingConversationRef = useRef(false);

  const pendingKey = useRef(null);

  function getStorageKey(value) {
    return `dormdrop:pending-offer:${listingId}:${value}`;
  }

  function clearPendingRequest(storageKey) {
    sessionStorage.removeItem(storageKey);
    pendingKey.current = null;
  }

  async function openConversation() {
    if (!onOfferSubmitted || openingConversationRef.current) return;

    openingConversationRef.current = true;
    setOpeningConversation(true);
    setError("");

    try {
      await onOfferSubmitted();
    } catch {
      setError(
        "Your offer was sent, but its conversation couldn't be opened. Please retry.",
      );
    } finally {
      openingConversationRef.current = false;
      setOpeningConversation(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitted) {
      await openConversation();
      return;
    }

    if (submittingRef.current) return;

    setError("");
    setSuccess("");

    const normalizedAmount = amount.trim();
    const value = Number(normalizedAmount);

    if (
      !/^\d+(\.\d{1,2})?$/.test(normalizedAmount) ||
      !Number.isFinite(value) ||
      value <= 0
    ) {
      setError("Enter a valid offer greater than $0.");
      return;
    }

    const storageKey = getStorageKey(value);

    const requestKey =
      pendingKey.current?.storageKey === storageKey
        ? pendingKey.current.key
        : sessionStorage.getItem(storageKey) ||
          newOfferRequestKey();

    pendingKey.current = {
      storageKey,
      key: requestKey,
    };

    sessionStorage.setItem(storageKey, requestKey);

    submittingRef.current = true;
    setSaving(true);
    let offerCreated = false;

    try {
      await createOffer(listingId, value, requestKey);
      offerCreated = true;

      clearPendingRequest(storageKey);
      setSubmitted(true);
      setSuccess("Your offer was sent to the seller successfully.");
      setAmount("");
    } catch (err) {
      const status = err.response?.status;

      if (status === 409) {
        clearPendingRequest(storageKey);

        setError(
          "This offer cannot be submitted. The listing may no longer be available or you may already have a pending offer."
        );
      } else if (status === 403) {
        clearPendingRequest(storageKey);

        setError(
          "You are not allowed to make an offer on this listing."
        );
      } else if (status === 400 || status === 422) {
        clearPendingRequest(storageKey);

        setError(
          err.response?.data?.message ||
            "The offer could not be accepted. Please check the amount."
        );
      } else if (!err.response) {
        setError(
          "Your connection was interrupted. Your offer may have been sent. You can retry with the same request, but do not change the amount until its status is confirmed."
        );
      } else {
        setError(
          err.response?.data?.message ||
            "We couldn't confirm whether your offer was sent. Please check your offers before retrying."
        );
      }
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }

    if (!offerCreated || !onOfferSubmitted) return;
    await openConversation();
  }

  return (
    <section className="offer-form-card">
      <h2>Make an offer</h2>

      <p>
        Listed price:{" "}
        {Number(listingPrice).toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        })}
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="buyer-offer-amount">
          Your offer amount
        </label>

        <div className="offer-amount-input">
          <span>$</span>

          <input
            id="buyer-offer-amount"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Enter amount"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              pendingKey.current = null;
              setError("");
              setSuccess("");
            }}
            disabled={saving || submitted}
            required={!submitted}
          />
        </div>

        {error && (
          <p className="offer-form-error" role="alert">
            {error}
          </p>
        )}

        {success && (
          <p className="offer-form-success" role="status">
            {success}
          </p>
        )}

        <Button
          type="submit"
          className="offer-submit-button"
          disabled={
            saving ||
            openingConversation ||
            (!submitted && !amount)
          }
        >
          {saving
            ? openingConversation
              ? "Opening conversation..."
              : "Sending offer..."
            : openingConversation
              ? "Opening conversation..."
              : submitted
                ? "Open conversation"
                : "Send offer"}
        </Button>
      </form>
    </section>
  );
}
