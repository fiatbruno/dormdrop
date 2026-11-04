import { useEffect, useRef, useState } from "react";
import { decideOffer } from "../../api/offersApi";
import CounterofferModal from "../CounterofferModal/CounterOfferModal";
import "./OfferNegotiation.css";

const money = (amount) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(amount));

const getProposal = (offer) => offer.currentProposal || offer.current || offer;

const getHistory = (offer, currentProposal) => {
  const entries =
    offer.history || offer.priceHistory || offer.proposals || offer.events;
  if (!Array.isArray(entries) || entries.length === 0) return [currentProposal];

  const history = entries
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) =>
        (Number(a.entry.version ?? a.entry.sequence) || a.index) -
        (Number(b.entry.version ?? b.entry.sequence) || b.index),
    )
    .map(({ entry }) => entry);
  const last = history.at(-1);
  if (
    String(last?.id ?? "") !== String(currentProposal.id ?? "") &&
    (Number(last?.version) !== Number(currentProposal.version) ||
      Number(last?.amount ?? last?.price) !==
        Number(currentProposal.amount ?? currentProposal.price))
  ) {
    history.push(currentProposal);
  }
  return history;
};

const normalizedRole = (role) => {
  const value = String(role || "").toUpperCase();
  return value === "BUYER" || value === "SELLER" ? value : null;
};

export default function OfferNegotiation({
  offer,
  listing,
  currentUserId,
  participant,
  onRefresh,
}) {
  const [counterofferOpen, setCounterofferOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const requestKeys = useRef(new Map());
  const summaryRef = useRef(null);
  const focusSummaryAfterUpdate = useRef(false);
  useEffect(() => {
    if (
      focusSummaryAfterUpdate.current &&
      !pendingAction &&
      !counterofferOpen
    ) {
      summaryRef.current?.focus();
      focusSummaryAfterUpdate.current = false;
    }
  }, [counterofferOpen, listing, offer, pendingAction]);

  if (!offer || !listing) return null;

  const currentProposal = getProposal(offer);
  const amount = Number(currentProposal.amount ?? offer.amount);
  const status = String(currentProposal.status || offer.status || "").toUpperCase();
  const version = Number(currentProposal.version ?? offer.version);
  const history = getHistory(offer, currentProposal);
  const lastHistory = history.at(-1);
  const proposerId =
    currentProposal.proposerId ||
    currentProposal.proposer?.id ||
    currentProposal.createdBy ||
    lastHistory?.proposerId ||
    lastHistory?.actorId ||
    null;
  const currentUserRole =
    currentUserId != null &&
    listing.ownerId != null &&
    String(currentUserId) === String(listing.ownerId)
      ? "SELLER"
      : currentUserId != null &&
          (offer.buyerId ?? offer.buyer?.id) != null &&
          String(currentUserId) ===
            String(offer.buyerId ?? offer.buyer.id)
        ? "BUYER"
        : null;
  const proposerRole =
    normalizedRole(currentProposal.proposerRole) ||
    normalizedRole(currentProposal.createdByRole) ||
    normalizedRole(lastHistory?.proposerRole) ||
    normalizedRole(lastHistory?.actorRole) ||
    (proposerId != null &&
    listing.ownerId != null &&
    String(proposerId) === String(listing.ownerId)
      ? "SELLER"
      : proposerId != null &&
          (offer.buyerId ?? offer.buyer?.id) != null &&
          String(proposerId) === String(offer.buyerId ?? offer.buyer.id)
        ? "BUYER"
        : null) ||
    (history.length === 1 && currentProposal === offer ? "BUYER" : null);
  const isCurrentUserProposer = proposerId
    ? String(proposerId) === String(currentUserId)
    : currentUserRole !== null && proposerRole === currentUserRole;
  const canRespond =
    currentUserRole !== null &&
    status === "PENDING" &&
    Number.isFinite(amount) &&
    Number.isInteger(version) &&
    version >= 0 &&
    proposerRole !== null &&
    proposerRole !== currentUserRole &&
    !isCurrentUserProposer;
  const proposerName =
    currentProposal.proposerName ||
    currentProposal.proposer?.name ||
    (proposerId && String(proposerId) !== String(currentUserId)
      ? participant?.name
      : proposerRole === "SELLER"
        ? "Seller"
        : "Buyer");
  const proposalLabel =
    proposerRole === "SELLER"
      ? `${proposerName}'s counteroffer`
      : `${proposerName}'s offer`;

  async function refreshAfterConflict() {
    const refreshed = await onRefresh();
    setError(
      refreshed === false
        ? "This offer changed, but the latest version could not be loaded. Please refresh and try again."
        : "This offer changed while you were responding. The latest version has been refreshed.",
    );
    focusSummaryAfterUpdate.current = true;
  }

  async function submitDecision(decision) {
    if (!canRespond || pendingAction) return;

    const operationId = `${offer.id}:${version}:${decision}`;
    if (!requestKeys.current.has(operationId)) {
      requestKeys.current.set(
        operationId,
        globalThis.crypto.randomUUID(),
      );
    }

    setPendingAction(decision);
    setError("");
    setConfirmation("");
    try {
      await decideOffer(
        offer.id,
        decision,
        version,
        requestKeys.current.get(operationId),
      );
      requestKeys.current.delete(operationId);
      const refreshed = await onRefresh();
      if (refreshed === false) {
        setError("Your decision was submitted, but the latest offer could not be loaded. Please refresh to confirm its status.");
      } else {
        setConfirmation(
          decision === "ACCEPT"
            ? `Agreed price: ${money(amount)}. No payment is taken in DormDrop.`
            : `Offer rejected at ${money(amount)}.`,
        );
      }
      focusSummaryAfterUpdate.current = true;
    } catch (requestError) {
      if (requestError.response?.status === 409) {
        await refreshAfterConflict();
      } else {
        setError(
          requestError.response?.data?.message ||
            "Could not update this offer. Please try again.",
        );
      }
    } finally {
      setPendingAction("");
    }
  }

  return (
    <section className="offer-negotiation" aria-labelledby="offer-title">
      <header className="offer-negotiation__header">
        <div>
          <h3 id="offer-title">Offer negotiation</h3>
          <p ref={summaryRef} tabIndex={-1}>
            {status === "ACCEPTED"
              ? `Agreed price: ${money(currentProposal.agreedAmount ?? amount)}`
              : status === "REJECTED" || status === "DECLINED"
                ? `Offer rejected at ${money(amount)}`
                : `Current proposal: ${money(amount)}`}
          </p>
        </div>
        <span className={`offer-negotiation__status is-${status.toLowerCase()}`}>
          {status === "DECLINED" ? "REJECTED" : status}
        </span>
      </header>

      <ol className="offer-negotiation__history" aria-label="Offer price history">
        {history.map((entry, index) => {
          const entryAmount = Number(entry.amount ?? entry.price);
          const entryRole =
            normalizedRole(entry.proposerRole) ||
            normalizedRole(entry.actorRole) ||
            (index === 0 ? "BUYER" : null);
          const entryName =
            entry.proposerName ||
            entry.actorName ||
            entry.proposer?.name ||
            (entry.proposerId &&
            String(entry.proposerId) === String(currentUserId)
              ? "You"
              : null) ||
            (entryRole === "SELLER" ? "Seller" : "Buyer");
          const entryStatus = String(entry.status || "").toUpperCase();

          return (
            <li key={entry.id || `${entry.version ?? index}-${index}`}>
              <span className="offer-negotiation__history-person">
                {entryName}
              </span>
              {Number.isFinite(entryAmount) && (
                <strong>{money(entryAmount)}</strong>
              )}
              {entryStatus && (
                <span className="offer-negotiation__history-status">
                  {entryStatus === "COUNTERED"
                    ? "Counteroffer"
                    : entryStatus}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {status === "PENDING" && (
        <p className="offer-negotiation__hint">
          {isCurrentUserProposer
            ? "Waiting for the other person to respond to your proposal."
            : canRespond
              ? "You can accept, reject, or counter the current proposal."
              : "Offer details are refreshing. Actions are unavailable until the latest version is confirmed."}
        </p>
      )}

      {confirmation && (
        <p className="offer-negotiation__confirmation" role="status">
          {confirmation}
        </p>
      )}
      {error && (
        <p className="offer-negotiation__error" role="alert">
          {error}
        </p>
      )}

      {canRespond && (
        <div className="offer-negotiation__actions">
          <button
            type="button"
            className="offer-negotiation__accept"
            disabled={Boolean(pendingAction)}
            onClick={() => void submitDecision("ACCEPT")}
          >
            {pendingAction === "ACCEPT" ? "Accepting…" : "Accept"}
          </button>
          <button
            type="button"
            className="offer-negotiation__reject"
            disabled={Boolean(pendingAction)}
            onClick={() => void submitDecision("REJECT")}
          >
            {pendingAction === "REJECT" ? "Rejecting…" : "Reject"}
          </button>
          <button
            type="button"
            className="offer-negotiation__counter"
            disabled={Boolean(pendingAction)}
            onClick={() => {
              setError("");
              setConfirmation("");
              setCounterofferOpen(true);
            }}
          >
            Counter
          </button>
        </div>
      )}

      {counterofferOpen && (
        <CounterofferModal
          key={`${offer.id}-${version}`}
          offer={{
            ...offer,
            ...currentProposal,
            id: offer.id,
            amount,
          }}
          listing={listing}
          proposerName={proposerName}
          proposalLabel={proposalLabel}
          expectedVersion={version}
          onClose={() => setCounterofferOpen(false)}
          onSuccess={async () => {
            setCounterofferOpen(false);
            const refreshed = await onRefresh();
            if (refreshed === false) {
              setError("Your counteroffer was sent, but the latest offer could not be loaded. Please refresh to confirm its status.");
            } else {
              setConfirmation("Counteroffer sent. The other person can respond to the updated proposal.");
            }
            focusSummaryAfterUpdate.current = true;
          }}
          onConflict={refreshAfterConflict}
        />
      )}
    </section>
  );
}
