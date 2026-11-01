
import { useState } from "react";
import Button from "../Button/Button";
import { createOffer } from "../../api/offerApi";
import "./OfferForm.css";

export default function OfferForm({
  listingId,
  listingPrice,
}) {
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (saving) return;

    setError("");
    setSuccess("");

    const value = Number(amount);

    if (
      !Number.isFinite(value) ||
      value <= 0 ||
      !/^\d+(\.\d{1,2})?$/.test(amount.trim())
    ) {
      setError("Enter a valid offer greater than $0.");
      return;
    }

    setSaving(true);

    try {
      await createOffer(listingId, value);

      setSuccess(
        "Your offer was sent to the seller successfully."
      );

      setAmount("");
    } catch (err) {
      const status = err.response?.status;

      if (status === 409) {
        setError(
          "This offer cannot be submitted. The listing may no longer be available or you may already have a pending offer."
        );
      } else if (status === 403) {
        setError(
          "You are not allowed to make an offer on this listing."
        );
      } else {
        setError(
          err.response?.data?.message ||
          "Could not submit your offer. Please try again."
        );
      }
    } finally {
      setSaving(false);
    }
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
            onChange={(event) => setAmount(event.target.value)}
            disabled={saving}
            required
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
          disabled={saving || !amount}
        >
          {saving ? "Sending offer..." : "Send offer"}
        </Button>
      </form>
    </section>
  );
}
