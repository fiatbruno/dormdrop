
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getConversationOffers } from "../../api/messagingApi";
import { acceptOffer, rejectOffer } from "../../api/offerApi";

function money(value) {
  if (value == null || !Number.isFinite(Number(value))) {
    return "Not available";
  }
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function timeLabel(date) {
  if (!date || Number.isNaN(Date.parse(date))) return "";
  return new Date(date).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function dateLabel(date) {
  if (!date || Number.isNaN(Date.parse(date))) return "";
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ConversationOffers({
  conversationId,
  currentUserId,
  messages,
  scrollRef,
  nearBottomRef,
  onNearBottom,
  onDecision,
  onArrangePickup,
}) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const generation = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    const version = ++generation.current;
    setOffers([]);
    setLoading(true);
    setError("");
    setBusyId(null);
    busyRef.current = false;

    async function load() {
      try {
        const data = await getConversationOffers(conversationId);
        if (generation.current !== version) return;

        if (!Array.isArray(data)) {
          throw new Error("Invalid conversation offers response.");
        }

        setOffers(data);
      } catch (err) {
        if (generation.current === version) {
          setError(
            err.response?.data?.message ||
            err.message ||
            "Could not load offers."
          );
        }
      } finally {
        if (generation.current === version) setLoading(false);
      }
    }

    void load();
    return () => { generation.current++; };
  }, [conversationId, refreshKey]);

  async function decide(offer, decision) {
    if (
      busyRef.current ||
      String(offer.status).toUpperCase() !== "PENDING"
    ) return;

    const version = generation.current;
    busyRef.current = true;
    setBusyId(offer.id);
    setError("");

    try {
      if (decision === "accept") {
        await acceptOffer(offer.id);
      } else {
        await rejectOffer(offer.id);
      }

      if (generation.current === version) {
        setRefreshKey((value) => value + 1);
        onDecision?.();
      }
    } catch (err) {
      if (generation.current === version) {
        setError(
          err.response?.data?.message ||
          "Could not update the offer. Check its status before retrying."
        );
        setRefreshKey((value) => value + 1);
      }
    } finally {
      if (generation.current === version) {
        busyRef.current = false;
        setBusyId(null);
      }
    }
  }

  // Only timestamped events are sorted chronologically.
  // Offers missing createdAt appear afterward rather
  // than being assigned an invented date.
  const events = [
    ...messages.map((message) => ({
      kind: "message",
      id: message.id,
      at: message.sentAt,
      data: message,
    })),
    ...offers.map((offer) => ({
      kind: "offer",
      id: offer.id,
      at: offer.createdAt,
      data: offer,
    })),
  ].sort((a, b) => {
    const aTime = Date.parse(a.at);
    const bTime = Date.parse(b.at);
    const aValid = Number.isFinite(aTime);
    const bValid = Number.isFinite(bTime);

    if (!aValid && !bValid) return 0;
    if (!aValid) return 1;
    if (!bValid) return -1;
    return aTime - bTime;
  });

  return (
    <>
      {error && (
        <div className="messages-offer-feedback">
          <p role="alert" className="messages-error">{error}</p>
          <button
            type="button"
            onClick={() => setRefreshKey((n) => n + 1)}
          >
            Retry loading offers
          </button>
        </div>
      )}

      <div
        className="messages-thread"
        ref={scrollRef}
        aria-label="Message and offer history"
        onScroll={() => {
          const node = scrollRef.current;
          if (!node) return;

          const near =
            node.scrollHeight -
            node.scrollTop -
            node.clientHeight < 90;

          nearBottomRef.current = near;
          if (near) onNearBottom?.();
        }}
      >
        {loading && (
          <p className="messages-state" role="status">
            Loading conversation offers...
          </p>
        )}

        {!loading && events.length === 0 && !error && (
          <p className="messages-state">
            Say hello and ask about the item.
          </p>
        )}

        {events.map((event, index) => {
          const previous = events[index - 1];
          const day = dateLabel(event.at);
          const showDate =
            day && (!previous || day !== dateLabel(previous.at));

          if (event.kind === "message") {
            const message = event.data;
            const outgoing =
              String(message.senderId) === String(currentUserId);

            return (
              <div key={`message-${event.id}`}>
                {showDate && (
                  <p className="messages-date">{day}</p>
                )}

                <div
                  className={`messages-bubble ${
                    outgoing ? "outgoing" : "incoming"
                  }`}
                >
                  <p>{message.content}</p>
                  <time dateTime={message.sentAt}>
                    {timeLabel(message.sentAt)}
                  </time>
                </div>
              </div>
            );
          }

          const offer = event.data;
          const status = String(offer.status || "").toUpperCase();
          const seller =
            currentUserId != null &&
            String(currentUserId) === String(offer.sellerId);
          const buyer =
            currentUserId != null &&
            String(currentUserId) === String(offer.buyerId);

          const pending = status === "PENDING";
          const accepted = status === "ACCEPTED";
          const declined =
            status === "REJECTED" || status === "DECLINED";

          return (
            <div key={`offer-${event.id}`}>
              {showDate && (
                <p className="messages-date">{day}</p>
              )}

              <article
                className={`messages-offer-card ${
                  status.toLowerCase()
                } ${seller ? "outgoing" : "incoming"}`}
              >
                <span className="messages-offer-status">
                  {pending
                    ? "Offer pending"
                    : accepted
                      ? "Offer accepted"
                      : declined
                        ? "Offer declined"
                        : status || "Status unavailable"}
                </span>

                <strong className="messages-offer-amount">
                  {money(offer.amount)}
                </strong>

                <p>Listing price: {money(offer.listingPrice)}</p>

                {pending && seller && (
                  <div className="messages-offer-actions">
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => decide(offer, "accept")}
                    >
                      {busyId === offer.id
                        ? "Processing..."
                        : "Accept offer"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => decide(offer, "reject")}
                    >
                      Decline
                    </button>
                  </div>
                )}

                {pending && buyer && (
                  <p>Waiting for the seller's decision.</p>
                )}

                {accepted && (
                  <>
                    <p>
                      {seller
                        ? "You accepted this offer."
                        : "Your offer was accepted."}
                      You can now arrange pickup in chat.
                    </p>
                    <button
                      type="button"
                      className="messages-pickup-button"
                      onClick={() => onArrangePickup?.(offer)}
                    >
                      Arrange pickup
                    </button>
                  </>
                )}

                {declined && (
                  <p>
                    {seller
                      ? "You declined this offer."
                      : "Your offer was declined."}
                  </p>
                )}

                {declined && buyer && offer.listingId && (
                  <Link to={`/items/${encodeURIComponent(offer.listingId)}`}>
                    Make another offer
                  </Link>
                )}

                <Link to={`/offers/${encodeURIComponent(offer.id)}`}>
                  View offer details
                </Link>

                {event.at && (
                  <time dateTime={event.at}>
                    {timeLabel(event.at)}
                  </time>
                )}
              </article>
            </div>
          );
        })}
      </div>
    </>
  );
}
