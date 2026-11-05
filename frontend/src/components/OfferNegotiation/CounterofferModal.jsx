import { useEffect, useRef, useState } from "react";

export default function CounterofferModal({
  amount,
  proposerLabel,
  onClose,
  onSubmit,
}) {
  const [value, setValue] = useState("");
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
    function handleKeyDown(event) {
      if (event.key === "Escape" && !submitting) {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = document.querySelector(".counteroffer-dialog");
      const focusable = dialog?.querySelectorAll(
        'button:not(:disabled), input:not(:disabled)',
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
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, submitting]);

  const counterAmount = Number(value);
  const valid =
    /^\d+(\.\d{1,2})?$/.test(value) &&
    Number.isFinite(counterAmount) &&
    counterAmount > 0 &&
    counterAmount !== Number(amount);

  async function submit(event) {
    event.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setError("");
    requestKey.current ||= globalThis.crypto.randomUUID();
    try {
      await onSubmit(counterAmount, requestKey.current);
    } catch (submitError) {
      setError(
        submitError?.response?.data?.message ||
          "Couldn't send your counteroffer. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="offer-negotiation__overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section
        className="counteroffer-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="counteroffer-dialog-title"
      >
        <h2 id="counteroffer-dialog-title">Send a counteroffer</h2>
        <p>{proposerLabel} proposed ${Number(amount).toFixed(2)}.</p>
        <form onSubmit={submit}>
          <label htmlFor="counteroffer-amount">Your counter price</label>
          <input
            ref={inputRef}
            id="counteroffer-amount"
            type="number"
            min="0.01"
            step="0.01"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError("");
              requestKey.current = null;
            }}
            required
            disabled={submitting}
          />
          {error && <p role="alert">{error}</p>}
          <div className="offer-negotiation__modal-actions">
            <button type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" disabled={!valid || submitting}>
              {submitting ? "Sending…" : "Send counteroffer"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
