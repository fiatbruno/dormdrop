import { useEffect, useRef, useState } from "react";
import { decideOffer, getOffer, sendCounteroffer } from "../../api/offersApi";
import CounterofferModal from "./CounterofferModal";
import "./OfferNegotiation.css";

const formatMoney = (amount) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(amount));

export default function OfferNegotiation({
  offer: initialOffer,
  listing,
  currentUserId,
  participant,
}) {
  const [offer, setOffer] = useState(initialOffer);
  const [counterOpen, setCounterOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(Date.now);
  const keys = useRef(new Map());
  const summaryRef = useRef(null);
  const restoreFocus = useRef(false);

  const expiresAt = Date.parse(offer?.expiresAt || "");

  useEffect(() => {
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return undefined;
    const timer = window.setTimeout(
      () => setClock(Date.now()),
      expiresAt - Date.now(),
    );
    return () => window.clearTimeout(timer);
  }, [expiresAt]);

  useEffect(() => {
    if (restoreFocus.current && !busy && !counterOpen) {
      summaryRef.current?.focus();
      restoreFocus.current = false;
    }
  }, [busy, counterOpen, offer]);

  if (!offer) return null;

  const amount = Number(offer.amount);
  const version = Number(offer.version);
  const status = String(offer.status || "").toUpperCase();
  const expired =
    status === "EXPIRED" ||
    (status === "PENDING" && Number.isFinite(expiresAt) && expiresAt <= clock);
  const currentStatus = expired ? "EXPIRED" : status;
  const userId = currentUserId == null ? "" : String(currentUserId);
  const buyerId = offer.buyerId == null ? "" : String(offer.buyerId);
  const sellerId = offer.sellerId == null ? "" : String(offer.sellerId);
  const proposerId =
    offer.currentProposerId == null ? "" : String(offer.currentProposerId);
  const isParticipant =
    Boolean(userId) && (userId === buyerId || userId === sellerId);
  const canRespond =
    isParticipant &&
    currentStatus === "PENDING" &&
    proposerId !== "" &&
    proposerId !== userId &&
    Number.isFinite(amount) &&
    amount > 0 &&
    Number.isInteger(version) &&
    version >= 0;
  const listingAvailable = listing?.status === "AVAILABLE";
  const canAccept = canRespond && listingAvailable;
  const canCounter = canRespond && listingAvailable;
  const proposerRole = proposerId === buyerId ? "Buyer" : "Seller";
  const proposerName =
    proposerId === String(participant?.id || "")
      ? participant?.name || proposerRole
      : proposerRole;
  const history = Array.isArray(offer.history) ? offer.history : [];

  function operationKey(decision) {
    const operationId = `${offer.id}:${version}:${decision}`;
    if (!keys.current.has(operationId)) {
      keys.current.set(operationId, globalThis.crypto.randomUUID());
    }
    return { operationId, key: keys.current.get(operationId) };
  }

  async function refreshAuthoritative() {
    const latest = await getOffer(offer.id);
    setOffer(latest);
    return latest;
  }

  async function decide(action) {
    if (!canRespond || (action === "ACCEPT" && !canAccept) || busy) return;
    setBusy(true);
    setPendingAction(action);
    setError("");
    setConfirmation("");
    const { operationId, key } = operationKey(action);
    try {
      const result = await decideOffer(offer.id, action, version, key);
      keys.current.delete(operationId);
      setOffer(result);
      setConfirmation(
        action === "ACCEPT"
          ? `Agreed price: ${formatMoney(amount)}. This records agreement only; no payment is taken and the listing is not marked sold.`
          : `Offer rejected at ${formatMoney(amount)}.`,
      );
      restoreFocus.current = true;
    } catch (requestError) {
      if (requestError.response?.status === 409) {
        try {
          await refreshAuthoritative();
          setError("This offer changed while you were responding. The latest version has been refreshed.");
        } catch {
          setError("This offer changed, but the latest version could not be loaded. Please retry.");
        }
      } else {
        setError(
          requestError.response?.data?.message ||
            "Couldn't update this offer. Please try again.",
        );
      }
    } finally {
      setBusy(false);
      setPendingAction("");
    }
  }

  async function counter(counterAmount, key) {
    if (!canCounter || busy) return;
    setBusy(true);
    setError("");
    setConfirmation("");
    const operationId = `${offer.id}:${version}:COUNTER`;
    keys.current.set(operationId, key);
    try {
      const result = await sendCounteroffer(
        offer.id,
        counterAmount,
        version,
        key,
      );
      keys.current.delete(operationId);
      setOffer(result);
      setCounterOpen(false);
      setConfirmation(
        `Counteroffer sent at ${formatMoney(counterAmount)}. This is a proposal only; no payment is taken.`,
      );
      restoreFocus.current = true;
    } catch (requestError) {
      if (requestError.response?.status === 409) {
        try {
          await refreshAuthoritative();
          setCounterOpen(false);
          setError("This offer changed while you were responding. The latest version has been refreshed.");
          restoreFocus.current = true;
        } catch {
          setError("This offer changed, but the latest version could not be loaded. Please retry.");
        }
      } else {
        throw requestError;
      }
    } finally {
      setBusy(false);
    }
  }

  const statusLabel =
    currentStatus === "ACCEPTED"
      ? `Agreed price: ${formatMoney(offer.agreedAmount ?? amount)}`
      : currentStatus === "REJECTED"
        ? `Offer rejected at ${formatMoney(amount)}`
        : currentStatus === "EXPIRED"
          ? `Offer expired at ${formatMoney(amount)}`
          : `Current proposal: ${formatMoney(amount)}`;

  return (
    <section className="offer-negotiation" aria-labelledby={`offer-title-${offer.id}`}>
      <header className="offer-negotiation__header">
        <div>
          <h2 id={`offer-title-${offer.id}`}>Offer negotiation</h2>
          <p ref={summaryRef} tabIndex={-1}>{statusLabel}</p>
        </div>
        <span className={`offer-negotiation__status is-${currentStatus.toLowerCase()}`}>
          {currentStatus}
        </span>
      </header>
      <ol className="offer-negotiation__history" aria-label="Offer price history">
        {history.map((entry, index) => {
          const actor = String(entry.actorId || "");
          const name =
            actor === userId
              ? "You"
              : actor === buyerId
                ? (buyerId === String(participant?.id || "") ? participant?.name : null) || "Buyer"
                : actor === sellerId
                  ? (sellerId === String(participant?.id || "") ? participant?.name : null) || "Seller"
                  : "Participant";
          return (
            <li key={`${entry.createdAt || index}-${entry.action}-${index}`}>
              <span>{name}</span>
              <strong>{formatMoney(entry.amount)}</strong>
              <span>{String(entry.action || "PROPOSED").replaceAll("_", " ")}</span>
            </li>
          );
        })}
      </ol>
      {currentStatus === "PENDING" && Number.isFinite(expiresAt) && (
        <p className="offer-negotiation__expiry">
          Respond by {new Intl.DateTimeFormat("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(expiresAt)}
        </p>
      )}
      {currentStatus === "EXPIRED" && (
        <p className="offer-negotiation__hint" role="status">
          This offer has expired. No further responses are available.
        </p>
      )}
      {currentStatus === "PENDING" && (
        <p className="offer-negotiation__hint">
          {!isParticipant
            ? "Only the buyer and seller can view or respond to this negotiation."
            : proposerId === userId
              ? "Waiting for the other participant to respond to your proposal."
              : canRespond
                ? "You can accept, reject, or counter the current proposal."
                : "This offer cannot be acted on until its latest state is confirmed."}
        </p>
      )}
      {currentStatus === "ACCEPTED" && (
        <p className="offer-negotiation__hint">
          Agreement only—this does not confirm payment, reserve the listing, or mark it sold.
        </p>
      )}
      {confirmation && <p role="status" className="offer-negotiation__confirmation">{confirmation}</p>}
      {error && <p role="alert" className="offer-negotiation__error">{error}</p>}
      {canRespond && (
        <div className="offer-negotiation__actions">
          <button type="button" disabled={!canAccept || busy} onClick={() => void decide("ACCEPT")}>
            {pendingAction === "ACCEPT" ? "Accepting…" : "Accept"}
          </button>
          <button type="button" disabled={busy} onClick={() => void decide("REJECT")}>
            {pendingAction === "REJECT" ? "Rejecting…" : "Reject"}
          </button>
          <button
            type="button"
            disabled={!canCounter || busy}
            onClick={() => {
              setError("");
              setConfirmation("");
              setCounterOpen(true);
            }}
          >
            Counter
          </button>
        </div>
      )}
      {counterOpen && (
        <CounterofferModal
          amount={amount}
          proposerLabel={`${proposerName}'s proposal`}
          onClose={() => setCounterOpen(false)}
          onSubmit={counter}
        />
      )}
    </section>
  );
}
