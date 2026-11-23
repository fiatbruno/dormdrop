
import { useEffect, useRef, useState } from "react";
import {
  confirmItemReceived,
  decideOffer,
  getCompletedTransaction,
  getOffer,
  sendCounteroffer,
} from "../../api/offersApi";
import { getPickupProposals } from "../../api/pickupApi";
import CounterofferModal from "./CounterofferModal";
import "./OfferNegotiation.css";

const formatMoney = (amount) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(amount));

function receiptErrorMessage(error) {
  const status = error.response?.status;
  const serverMessage =
    error.response?.data?.detail ||
    error.response?.data?.message ||
    error.response?.data?.error;

  if (status === 401) {
    return "Your session has expired. Please sign in again.";
  }

  if (status === 403) {
    return "You are not authorized to confirm receipt of this item.";
  }

  if (status === 409) {
    return (
      serverMessage ||
      "The exchange is not ready for receipt confirmation. Check the pickup details and try again."
    );
  }

  if (status === 400) {
    return (
      serverMessage ||
      "This receipt confirmation could not be processed."
    );
  }

  return serverMessage || "Something went wrong. Please try again.";
}

export default function OfferNegotiation({
  offer: initialOffer,
  conversationId,
  listing,
  currentUserId,
  participant,
  onOfferUpdated,
}) {
  const [offer, setOffer] = useState(initialOffer);
  const [counterOpen, setCounterOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(Date.now);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptError, setReceiptError] = useState("");
  const [receiptChecking, setReceiptChecking] = useState(false);
  const [receiptLookupError, setReceiptLookupError] = useState("");
  const [completedTransaction, setCompletedTransaction] = useState(null);
  const [receiptChecked, setReceiptChecked] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [pickupProposals, setPickupProposals] = useState([]);
  const [pickupLoaded, setPickupLoaded] = useState(false);
  const [pickupClock, setPickupClock] = useState(Date.now());

  const keys = useRef(new Map());
  const summaryRef = useRef(null);
  const restoreFocus = useRef(false);
  const receiptInFlight = useRef(false);
  const receiptDialogRef = useRef(null);
  const receiptTriggerRef = useRef(null);

  const expiresAt = Date.parse(offer?.expiresAt || "");

  useEffect(() => {
    setOffer((previous) =>
      Number(initialOffer?.version) > Number(previous?.version)
        ? initialOffer
        : previous,
    );
  }, [initialOffer]);

  useEffect(() => {
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return undefined;
    }

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

  const offerId = offer?.id;
  const offerStatus = String(offer?.status || "").toUpperCase();
  const userId = currentUserId == null ? "" : String(currentUserId);
  const buyerId = offer?.buyerId == null ? "" : String(offer.buyerId);
  const isBuyer = Boolean(userId) && userId === buyerId;
  const acceptedBuyer = isBuyer && offerStatus === "ACCEPTED";

  useEffect(() => {
    if (!acceptedBuyer || !offerId) {
      return undefined;
    }

    let active = true;

    async function checkTransaction() {
      setReceiptChecking(true);
      setReceiptChecked(false);
      setReceiptLookupError("");

      try {
        const transaction = await getCompletedTransaction(offerId);

        if (active) {
          setCompletedTransaction(transaction);
          setReceiptChecked(true);
        }
      } catch (requestError) {
        if (!active) return;

        if (requestError.response?.status === 404) {
          setCompletedTransaction(null);
          setReceiptChecked(true);
        } else {
          setReceiptLookupError(receiptErrorMessage(requestError));
        }
      } finally {
        if (active) setReceiptChecking(false);
      }
    }

    void checkTransaction();

    return () => {
      active = false;
    };
  }, [acceptedBuyer, offerId]);

  useEffect(() => {
    if (!acceptedBuyer || !conversationId) {
      setPickupProposals([]);
      setPickupLoaded(false);
      return undefined;
    }

    let active = true;

    async function refreshPickup() {
      try {
        const result = await getPickupProposals(conversationId);

        if (active) {
          setPickupProposals(Array.isArray(result) ? result : []);
          setPickupLoaded(true);
          setPickupClock(Date.now());
        }
      } catch {
        if (active) {
          setPickupProposals([]);
          setPickupLoaded(false);
        }
      }
    }

    void refreshPickup();

    const interval = window.setInterval(() => {
      setPickupClock(Date.now());
      void refreshPickup();
    }, 12000);

    const onFocus = () => {
      setPickupLoaded(false);
      void refreshPickup();
    };

    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [acceptedBuyer, conversationId]);

  useEffect(() => {
    if (!receiptOpen && !completionOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key !== "Escape" || receiptBusy) return;

      setReceiptOpen(false);
      setCompletionOpen(false);
      receiptTriggerRef.current?.focus();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [receiptOpen, completionOpen, receiptBusy]);

  useEffect(() => {
    if (receiptOpen) receiptDialogRef.current?.focus();
  }, [receiptOpen]);

  if (!offer) return null;

  const amount = Number(offer.amount);
  const version = Number(offer.version);
  const status = String(offer.status || "").toUpperCase();

  const expired =
    status === "EXPIRED" ||
    (status === "PENDING" &&
      Number.isFinite(expiresAt) &&
      expiresAt <= clock);

  const currentStatus = expired ? "EXPIRED" : status;
  const sellerId = offer.sellerId == null ? "" : String(offer.sellerId);
  const proposerId =
    offer.currentProposerId == null
      ? ""
      : String(offer.currentProposerId);

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
  const agreedPrice = offer.agreedAmount ?? offer.amount;

  const latestPickup = [...pickupProposals].sort((a, b) => {
    const byTime =
      Date.parse(b.timeCreated || "") -
      Date.parse(a.timeCreated || "");

    if (Number.isFinite(byTime) && byTime !== 0) {
      return byTime;
    }

    return String(b.id || "").localeCompare(String(a.id || ""));
  })[0];

  const campusParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(pickupClock));

  const campusPart = (type) =>
    campusParts.find((part) => part.type === type)?.value || "00";

  const campusTime =
    `${campusPart("year")}-${campusPart("month")}-${campusPart("day")}` +
    `T${campusPart("hour")}:${campusPart("minute")}:${campusPart("second")}`;

  const scheduledPickupTime = String(
    latestPickup?.timePickUp || "",
  ).replace(" ", "T");

  const validPickupTime =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(scheduledPickupTime);

  const pickupHasPassed =
    pickupLoaded &&
    String(latestPickup?.status || "").toUpperCase() === "ACCEPTED" &&
    validPickupTime &&
    scheduledPickupTime.slice(0, 19).padEnd(19, "0") <= campusTime;

  const currentReservation =
    String(listing?.status || "").toUpperCase() === "RESERVED" &&
    (!listing?.reservedOfferId ||
      String(listing.reservedOfferId) === String(offerId));

  const canConfirmReceipt =
    acceptedBuyer &&
    receiptChecked &&
    !receiptChecking &&
    !receiptLookupError &&
    !completedTransaction &&
    currentReservation &&
    pickupHasPassed;

  function operationKey(decision) {
    const operationId = `${offer.id}:${version}:${decision}`;

    if (!keys.current.has(operationId)) {
      keys.current.set(operationId, globalThis.crypto.randomUUID());
    }

    return {
      operationId,
      key: keys.current.get(operationId),
    };
  }

  async function refreshAuthoritative() {
    const latest = await getOffer(offer.id);
    setOffer(latest);
    onOfferUpdated?.(latest);
    return latest;
  }

  async function decide(action) {
    if (!canRespond || (action === "ACCEPT" && !canAccept) || busy) {
      return;
    }

    setBusy(true);
    setPendingAction(action);
    setError("");
    setConfirmation("");

    const { operationId, key } = operationKey(action);

    try {
      const result = await decideOffer(
        offer.id,
        action,
        version,
        key,
      );

      keys.current.delete(operationId);
      setOffer(result);
      onOfferUpdated?.(result);

      setConfirmation(
        action === "ACCEPT"
          ? `Agreement only; no payment is taken. Agreed price: ${formatMoney(amount)}. The listing is reserved for this exchange and is not yet marked as sold.`
          : `Offer rejected at ${formatMoney(amount)}.`,
      );

      restoreFocus.current = true;
    } catch (requestError) {
      if (requestError.response?.status === 409) {
        try {
          await refreshAuthoritative();
          setError(
            "This offer changed while you were responding. The latest version has been refreshed.",
          );
        } catch {
          setError(
            "This offer changed, but the latest version could not be loaded. Please retry.",
          );
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
      onOfferUpdated?.(result);
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
          setError(
            "This offer changed while you were responding. The latest version has been refreshed.",
          );
          restoreFocus.current = true;
        } catch {
          setError(
            "This offer changed, but the latest version could not be loaded. Please retry.",
          );
        }
      } else {
        throw requestError;
      }
    } finally {
      setBusy(false);
    }
  }

  function openReceiptConfirmation() {
    if (!canConfirmReceipt) return;

    setReceiptError("");
    setReceiptOpen(true);
  }

  function closeReceiptConfirmation() {
    if (receiptBusy) return;

    setReceiptOpen(false);
    setReceiptError("");
    receiptTriggerRef.current?.focus();
  }

  async function handleConfirmReceipt() {
    if (!canConfirmReceipt || receiptInFlight.current) return;

    receiptInFlight.current = true;
    setReceiptBusy(true);
    setReceiptError("");

    try {
      const transaction = await confirmItemReceived(offer.id);

      setCompletedTransaction(transaction);
      setReceiptChecked(true);
      setReceiptOpen(false);
      setCompletionOpen(true);

      try {
        await refreshAuthoritative();
      } catch {
        onOfferUpdated?.(offer);
      }
    } catch (requestError) {
      setReceiptError(receiptErrorMessage(requestError));
    } finally {
      receiptInFlight.current = false;
      setReceiptBusy(false);
    }
  }

  function closeCompletion() {
    setCompletionOpen(false);
    receiptTriggerRef.current?.focus();
  }

  const statusLabel =
    currentStatus === "ACCEPTED"
      ? `Agreed price: ${formatMoney(agreedPrice)}`
      : currentStatus === "REJECTED"
        ? `Offer rejected at ${formatMoney(amount)}`
        : currentStatus === "EXPIRED"
          ? `Offer expired at ${formatMoney(amount)}`
          : `Current proposal: ${formatMoney(amount)}`;

  return (
    <>
      <section
        className="offer-negotiation"
        aria-labelledby={`offer-title-${offer.id}`}
      >
        <header className="offer-negotiation__header">
          <div>
            <h2 id={`offer-title-${offer.id}`}>Offer negotiation</h2>
            <p ref={summaryRef} tabIndex={-1}>
              {statusLabel}
            </p>
          </div>

          <span
            className={`offer-negotiation__status is-${currentStatus.toLowerCase()}`}
          >
            {currentStatus}
          </span>
        </header>

        <ol
          className="offer-negotiation__history"
          aria-label="Offer price history"
        >
          {history.map((entry, index) => {
            const actor = String(entry.actorId || "");

            const name =
              actor === userId
                ? "You"
                : actor === buyerId
                  ? (buyerId === String(participant?.id || "")
                      ? participant?.name
                      : null) || "Buyer"
                  : actor === sellerId
                    ? (sellerId === String(participant?.id || "")
                        ? participant?.name
                        : null) || "Seller"
                    : "Participant";

            return (
              <li
                key={`${entry.createdAt || index}-${entry.action}-${index}`}
              >
                <span>{name}</span>
                <strong>{formatMoney(entry.amount)}</strong>
                <span>
                  {String(entry.action || "PROPOSED").replaceAll("_", " ")}
                </span>
              </li>
            );
          })}
        </ol>

        {currentStatus === "PENDING" &&
          Number.isFinite(expiresAt) && (
            <p className="offer-negotiation__expiry">
              Respond by{" "}
              {new Intl.DateTimeFormat("en-US", {
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
            The offer has been accepted and the listing is reserved.
            The exchange is not complete until the buyer confirms receipt.
          </p>
        )}

        {confirmation && (
          <p
            role="status"
            className="offer-negotiation__confirmation"
          >
            {confirmation}
          </p>
        )}

        {error && (
          <p role="alert" className="offer-negotiation__error">
            {error}
          </p>
        )}

        {canRespond && (
          <div className="offer-negotiation__actions">
            <button
              type="button"
              disabled={!canAccept || busy}
              onClick={() => void decide("ACCEPT")}
            >
              {pendingAction === "ACCEPT" ? "Accepting..." : "Accept"}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => void decide("REJECT")}
            >
              {pendingAction === "REJECT" ? "Rejecting..." : "Reject"}
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

        {acceptedBuyer && (
          <div className="offer-receipt-entry">
            {receiptChecking && (
              <p role="status">
                Checking exchange status...
              </p>
            )}

            {receiptLookupError && (
              <div>
                <p role="alert" className="offer-negotiation__error">
                  {receiptLookupError}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setReceiptLookupError("");
                    setReceiptChecked(false);
                    setReceiptChecking(true);

                    getCompletedTransaction(offer.id)
                      .then((transaction) => {
                        setCompletedTransaction(transaction);
                        setReceiptChecked(true);
                      })
                      .catch((requestError) => {
                        if (requestError.response?.status === 404) {
                          setCompletedTransaction(null);
                          setReceiptChecked(true);
                        } else {
                          setReceiptLookupError(
                            receiptErrorMessage(requestError),
                          );
                        }
                      })
                      .finally(() => setReceiptChecking(false));
                  }}
                >
                  Retry status check
                </button>
              </div>
            )}

            {completedTransaction ? (
              <div className="offer-receipt-completed-inline">
                <span className="offer-receipt-badge">
                  Completed
                </span>
                <p>
                  You have confirmed receipt of this item.
                </p>
                <button
                  type="button"
                  ref={receiptTriggerRef}
                  onClick={() => setCompletionOpen(true)}
                >
                  View completed exchange
                </button>
              </div>
            ) : (
              canConfirmReceipt && (
                <div className="offer-receipt-entry__content">
                  <h3>Ready to complete your exchange?</h3>
                  <p>
                    After collecting and inspecting the item, confirm
                    that you have received it.
                  </p>
                  <button
                    type="button"
                    ref={receiptTriggerRef}
                    onClick={openReceiptConfirmation}
                  >
                    Confirm item received
                  </button>
                </div>
              )
            )}
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

      {receiptOpen && (
        <div className="offer-receipt-overlay">
          <div
            className="offer-receipt-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="offer-receipt-title"
            tabIndex={-1}
            ref={receiptDialogRef}
          >
            <h2 id="offer-receipt-title">
              Did you receive the item?
            </h2>

            <p className="offer-receipt-item">
              Agreed price {formatMoney(agreedPrice)}
            </p>

            <div className="offer-receipt-info">
              <h3>Confirm after inspecting the item</h3>
              <p>
                This records the exchange as completed and lets
                you review the seller.
              </p>
            </div>

            {receiptError && (
              <p className="offer-receipt-error" role="alert">
                {receiptError}
              </p>
            )}

            <div className="offer-receipt-actions">
              <button
                type="button"
                className="offer-receipt-cancel"
                disabled={receiptBusy}
                onClick={closeReceiptConfirmation}
              >
                Cancel
              </button>

              <button
                type="button"
                className="offer-receipt-primary"
                disabled={receiptBusy}
                onClick={() => void handleConfirmReceipt()}
              >
                {receiptBusy ? "Confirming..." : "Yes, received"}
              </button>
            </div>
          </div>
        </div>
      )}

      {completionOpen && completedTransaction && (
        <div className="offer-receipt-overlay">
          <div
            className="offer-receipt-dialog offer-receipt-success"
            role="dialog"
            aria-modal="true"
            aria-labelledby="offer-completed-title"
          >
            <span className="offer-receipt-badge">
              Completed
            </span>

            <h2 id="offer-completed-title">
              Exchange completed
            </h2>

            <p>
              Your receipt confirmation has been recorded.
              Share your experience to help other campus buyers.
            </p>

            <div className="offer-receipt-success-actions">
              <button
                type="button"
                className="offer-receipt-primary"
                disabled
                title="Seller reviews will be added in the next story."
              >
                Rate the seller
              </button>

              <button
                type="button"
                className="offer-receipt-cancel"
                onClick={closeCompletion}
              >
                Back to exchange
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
