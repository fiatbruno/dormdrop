import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Tag } from "lucide-react";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import ListingImage from "../../components/ListingImage";
import useMessaging from "../../hooks/useMessaging";
import {
  getMyReportedMessageIds,
  reportMessage,
  getPickupProposals,
  createPickupProposal,
  respondToPickupProposal,
} from "../../api/messagingApi";
import PickupForm from "../../components/PickupForm/PickupForm";
import "./Messages.css";
import OfferNegotiation from "../../components/OfferNegotiation/OfferNegotiation";

const initials = (name) =>
  (name || "Member")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
const dateLabel = (date) =>
  new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const timeLabel = (date) =>
  date
    ? new Date(date).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
const pickupTimeLabel = (value) => {
  const date = new Date(`${value}Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        timeZone: "UTC",
        weekday: "long",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date);
};
function priceLabel(item) {
  if (item.listingType === "Free / Donate") return "Free";
  if (item.listingType === "Trade") return "Trade";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(item.price);
}

function PickupDetails({ proposal, canRespond, onRespond }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const status = proposal.status === "REJECTED" ? "Declined" : proposal.status === "ACCEPTED" ? "Accepted" : "Pending";

  async function respond(decision) {
    if (pending.current) return;
    pending.current = true;
    setSubmitting(true);
    setError("");
    try { await onRespond(proposal.id, decision); }
    catch (err) {
      setError(err.response?.status === 409
        ? "This proposal has already been answered. Its latest status has been requested."
        : err.response?.data?.detail || err.response?.data?.message ||
          "Could not confirm your response. Refresh the conversation before trying again.");
    } finally { pending.current = false; setSubmitting(false); }
  }

  return <>
    <p className="pickup-card__status">{status}</p>
    <details>
      <summary>View pickup details →</summary>
      {proposal.meetingNote && <p>{proposal.meetingNote}</p>}
      {proposal.status === "PENDING" && canRespond && typeof proposal.id === "string" &&
        <div className="pickup-card__actions">
          <button type="button" disabled={submitting} onClick={() => void respond("ACCEPTED")}>Accept</button>
          <button type="button" disabled={submitting} onClick={() => void respond("REJECTED")}>Decline</button>
        </div>}
      {error && <p role="alert" className="pickup-card__error">{error}</p>}
    </details>
  </>;
}

export default function Messages() {
  const { conversationId } = useParams();
  const chat = useMessaging(conversationId);
  const [pickupFormConversation, setPickupFormConversation] = useState(null);
  const [pickupState, setPickupState] = useState({
    id: null,
    proposals: [],
    error: "",
  });
  const pickupRevision = useRef(0);
  const selectedPickupConversation = useRef(conversationId);
  useLayoutEffect(() => { selectedPickupConversation.current = conversationId; }, [conversationId]);
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [newMessages, setNewMessages] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportError, setReportError] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportedMessageIds, setReportedMessageIds] = useState([]);
  const [reportedMessageIdsError, setReportedMessageIdsError] = useState("");
  const scroll = useRef(null);
  const composerInput = useRef(null);
  const nearBottom = useRef(true);
  const previous = useRef({ id: null, last: null, sent: 0 });
  const refreshPickups = useCallback(async (current) => {
    if (!current) return;
    const revision = ++pickupRevision.current;
    try {
      const proposals = await getPickupProposals(current);
      if (!Array.isArray(proposals)) throw new Error("Invalid pickup proposals response");
      if (revision === pickupRevision.current && selectedPickupConversation.current === current)
        setPickupState({ id: current, proposals, error: "" });
    } catch {
      if (revision === pickupRevision.current && selectedPickupConversation.current === current)
        setPickupState((previous) => ({ id: current, proposals: previous.id === current ? previous.proposals : [],
          error: "Could not load pickup proposals. Try again." }));
    }
  }, []);
  useEffect(() => {
    const revisionRef = pickupRevision;
    // The refresh only updates state after the request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshPickups(conversationId);
    return () => { revisionRef.current++; setPickupFormConversation(null); };
  }, [conversationId, refreshPickups]);
  const bottom = () => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
    nearBottom.current = true;
    setNewMessages(false);
  };
  useEffect(() => {
    const last = chat.messages.at(-1)?.id;
    if (
      previous.current.id !== conversationId ||
      previous.current.sent !== chat.sentVersion ||
      nearBottom.current
    )
      bottom();
    else if (last && last !== previous.current.last) setNewMessages(true);
    previous.current = { id: conversationId, last, sent: chat.sentVersion };
  }, [chat.messages, conversationId, chat.sentVersion, pickupState]);
  useEffect(() => {
    let active = true;
    if (!conversationId) return;
    getMyReportedMessageIds(conversationId)
      .then((ids) => {
        if (active) {
          setReportedMessageIds(ids);
          setReportedMessageIdsError("");
        }
      })
      .catch(() => {
        if (active) {
          setReportedMessageIdsError(
            "Previously reported messages could not be checked. The server will prevent duplicate reports.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [conversationId]);

  const query = search.trim().toLowerCase();
  const conversations = chat.conversations.filter(
    (item) =>
      (!unreadOnly || item.unreadCount > 0) &&
      [item.participant.name, item.listing?.title, item.lastMessagePreview]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
  );
  const unreadCount = chat.conversations.filter(
    (item) => item.unreadCount > 0,
  ).length;
  const item = chat.conversation?.listing;
  const offer = chat.conversation?.offer;
  const offerAccepted = offer?.status === "ACCEPTED";
  const acceptedAt =
    offer?.history?.findLast((entry) => entry.action === "ACCEPTED")
      ?.createdAt ||
    offer?.updatedAt ||
    offer?.createdAt;
  const timeline = [
    ...chat.messages.map((message) => ({
      type: "message",
      at: message.sentAt,
      message,
    })),
    ...(pickupState.id === conversationId ? pickupState.proposals : []).map(
      (proposal) => ({ type: "pickup", at: proposal.timeCreated, proposal }),
    ),
    ...(offer
      ? [
          {
            type: "offer",
            at: offer.createdAt || offer.history?.[0]?.createdAt,
          },
        ]
      : []),
    ...(offerAccepted ? [{ type: "accepted", at: acceptedAt }] : []),
  ].sort((a, b) => {
    const first = Date.parse(a.at);
    const second = Date.parse(b.at);
    const firstTime = Number.isFinite(first) ? first : -Infinity;
    const secondTime = Number.isFinite(second) ? second : -Infinity;
    if (firstTime !== secondTime) return firstTime - secondTime;
    const order = { offer: 0, accepted: 1, message: 2, pickup: 3 };
    return order[a.type] - order[b.type];
  });
  const agreedPrice = Number(offer?.amount);
  const formattedAgreedPrice = Number.isFinite(agreedPrice)
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(agreedPrice)
    : "";
  const formattedListingPrice =
    item && Number.isFinite(Number(item.price))
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 2,
        }).format(Number(item.price))
      : "";

  function arrangePickup() {
    setPickupFormConversation(conversationId);
  }

  async function submitPickup({ location, pickupDate, pickupTime }) {
    const current = conversationId;
    const proposal = await createPickupProposal(current, {
      meetingPlace: location,
      timePickup: `${pickupDate}T${pickupTime}:00`,
    });
    if (selectedPickupConversation.current !== current) return;
    pickupRevision.current++;
    nearBottom.current = true;
    setPickupState((previous) => ({
      id: current,
      proposals: [
        ...(previous.id === current ? previous.proposals : []),
        proposal,
      ],
      error: "",
    }));
    void refreshPickups(current);
  }

  async function respondPickup(proposalId, decision) {
    const current = conversationId;
    try {
      const proposal = await respondToPickupProposal(current, proposalId, decision);
      if (selectedPickupConversation.current !== current) return;
      pickupRevision.current++;
      setPickupState((previous) => previous.id !== current ? previous : {
        ...previous, proposals: previous.proposals.map((item) => item.id === proposal.id ? proposal : item),
      });
      void refreshPickups(current);
    } catch (error) {
      if (error.response?.status === 409) void refreshPickups(current);
      throw error;
    }
  }

  function closeReportDialog() {
    if (reportSubmitting) return;
    setReportTarget(null);
    setReportReason("");
    setReportDetails("");
    setReportError("");
    setReportSubmitted(false);
  }

  async function submitMessageReport(event) {
    event.preventDefault();
    const reason = reportReason.trim();
    if (!reason || !reportDetails.trim()) {
      setReportError(
        !reason && !reportDetails.trim()
          ? "Select a reason and explain what happened before submitting."
          : !reason
            ? "Select a reason before submitting."
            : "Enter what happened before submitting.",
      );
      return;
    }

    setReportSubmitting(true);
    setReportError("");
    try {
      await reportMessage(conversationId, reportTarget.id, {
        reason,
        details: reportDetails.trim() || undefined,
      });
      setReportedMessageIds((ids) => [...ids, reportTarget.id]);
      setReportSubmitted(true);
    } catch (error) {
      setReportError(
        error.response?.status === 409
          ? "You have already reported this message."
          : error.response?.status === 403
            ? "You can't report your own message."
            : error.response?.data?.message ||
              "We couldn't submit your report. Please try again.",
      );
    } finally {
      setReportSubmitting(false);
    }
  }

  return (
    <div className="messages-shell">
      <Navbar showSearch={false} />
      <main className="messages-page">
        <header className="messages-heading">
          <div>
            <h1>Messages</h1>
            <p>A good find starts with a conversation.</p>
          </div>
          <div className="messages-heading-actions">
            <span role="status">{chat.connection}</span>
            <button type="button" disabled>
              Your Exchange
            </button>
            <button
              type="button"
              onClick={arrangePickup}
              disabled={!chat.conversation}
            >
              Propose pickup
            </button>
          </div>
        </header>
        <div
          className={`messages-workspace ${conversationId ? "has-selection" : ""}`}
        >
          <aside className="messages-sidebar" aria-label="Your conversations">
            <h2>Your conversations</h2>
            <input
              type="search"
              aria-label="Search conversations"
              placeholder="Search conversations…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div
              className="messages-filters"
              role="group"
              aria-label="Conversation filter"
            >
              <button
                type="button"
                aria-pressed={!unreadOnly}
                onClick={() => setUnreadOnly(false)}
              >
                All
              </button>
              <button
                type="button"
                aria-pressed={unreadOnly}
                onClick={() => setUnreadOnly(true)}
              >
                Unread {unreadCount || ""}
              </button>
            </div>
            {chat.listLoading && (
              <p role="status" className="messages-state">
                Loading conversations…
              </p>
            )}
            {chat.listError && (
              <p role="alert" className="messages-error">
                {chat.listError}
              </p>
            )}
            {!chat.listLoading &&
              !chat.listError &&
              conversations.length === 0 && (
                <p className="messages-state">
                  {query || unreadOnly
                    ? "No matching conversations."
                    : "No conversations yet. Contact a seller to get started."}
                </p>
              )}
            <nav className="messages-conversations" aria-label="Conversations">
              {conversations.map((conversation) => (
                <Link
                  key={conversation.id}
                  to={`/messages/${conversation.id}`}
                  className={`messages-conversation ${conversation.id === conversationId ? "selected" : ""}`}
                  aria-current={
                    conversation.id === conversationId ? "page" : undefined
                  }
                >
                  <span className="messages-avatar" aria-hidden="true">
                    {initials(conversation.participant.name)}
                  </span>
                  <div>
                    <div className="messages-conversation-top">
                      <strong>{conversation.participant.name}</strong>
                      <time dateTime={conversation.lastMessageAt}>
                        {dateLabel(conversation.lastMessageAt)}
                      </time>
                    </div>
                    <p className="messages-item-title">
                      {conversation.listing?.title || "Listing unavailable"}
                    </p>
                    <p className="messages-preview">
                      {conversation.lastMessagePreview ||
                        "Start the conversation"}
                    </p>
                    {conversation.unreadCount > 0 && (
                      <span className="messages-unread">
                        {conversation.unreadCount} unread
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </nav>
            <p className="messages-sidebar-note">
              Keep conversations and pickup arrangements on DormDrop.
            </p>
          </aside>
          <section className="messages-chat" aria-label="Selected conversation">
            {!conversationId ? (
              <div className="messages-empty">
                <h2>Select a conversation</h2>
                <p>Your campus finds start here.</p>
              </div>
            ) : (
              <>
                <Link to="/messages" className="messages-back">
                  ← Back to conversations
                </Link>
                {chat.loading ? (
                  <p role="status" className="messages-state">
                    Loading conversation…
                  </p>
                ) : chat.error ? (
                  <div role="alert" className="messages-state">
                    <p>{chat.error}</p>
                    <button type="button" onClick={chat.refresh}>
                      Try again
                    </button>
                  </div>
                ) : (
                  chat.conversation && (
                    <>
                      <header className="messages-chat-heading">
                        <span className="messages-avatar" aria-hidden="true">
                          {initials(chat.conversation.participant.name)}
                        </span>
                        <div>
                          <h2>{chat.conversation.participant.name}</h2>
                          <p>
                            {chat.conversation.participant.emailVerified
                              ? "Verified college email"
                              : "DormDrop community member"}
                          </p>
                        </div>
                      </header>
                      <div className="messages-listing">
                        {item ? (
                          <>
                            <ListingImage
                              src={item.imageUrl}
                              alt={item.title}
                              fallback={
                                <div className="messages-photo-placeholder">
                                  No photo
                                </div>
                              }
                            />
                            <div>
                              <h3>{item.title}</h3>
                              <p>
                                {priceLabel(item)} · {item.status.toLowerCase()}
                              </p>
                            </div>
                            <Link to={`/items/${item.id}`}>View item</Link>
                            {offerAccepted && (
                              <span className="messages-price-agreed">
                                Price agreed
                              </span>
                            )}
                          </>
                        ) : (
                          <p>
                            Listing unavailable. You can still continue this
                            conversation.
                          </p>
                        )}
                      </div>
                      <div
                        className="messages-thread"
                        ref={scroll}
                        onScroll={() => {
                          const node = scroll.current;
                          nearBottom.current =
                            node.scrollHeight -
                              node.scrollTop -
                              node.clientHeight <
                            90;
                          if (nearBottom.current) setNewMessages(false);
                        }}
                        aria-label="Message history"
                      >
                        {pickupState.id === conversationId &&
                          pickupState.error && (
                            <p role="alert" className="messages-error">
                              {pickupState.error}
                              <button type="button" onClick={() => void refreshPickups(conversationId)}>Try again</button>
                            </p>
                          )}
                        {timeline.length === 0 && (
                          <p className="messages-state">
                            Say hello and ask about the item.
                          </p>
                        )}
                        {timeline.map((event, index) => {
                          const date = Number.isFinite(Date.parse(event.at))
                            ? dateLabel(event.at)
                            : "";
                          const previousDate = Number.isFinite(
                            Date.parse(timeline[index - 1]?.at),
                          )
                            ? dateLabel(timeline[index - 1].at)
                            : "";
                          const showDate = date && date !== previousDate;
                          if (event.type === "pickup") {
                            const proposal = event.proposal;
                            const outgoing =
                              (typeof proposal.idSuggester === "string" &&
                                proposal.idSuggester ===
                                  chat.conversation.currentUserId);
                            const sender = outgoing
                              ? " · Sent by you"
                              : typeof proposal.idSuggester === "string"
                                ? ` · Sent by ${chat.conversation.participant.name}`
                                : "";
                            return (
                              <div
                                key={`pickup-${typeof proposal.id === "string" ? proposal.id : index}`}
                              >
                                {showDate && (
                                  <p className="messages-date">{date}</p>
                                )}
                                <article
                                  className={`pickup-card ${outgoing ? "outgoing" : ""}`}
                                  aria-label="Pickup proposal"
                                >
                                  <p className="pickup-card__eyebrow">
                                    Pickup proposal{sender}
                                  </p>
                                  <h3>{proposal.meetingPlace}</h3>
                                  <p>{pickupTimeLabel(proposal.timePickUp)}</p>
                                  <PickupDetails proposal={proposal} canRespond={typeof proposal.idSuggester === "string" && typeof chat.conversation.currentUserId === "string" && proposal.idSuggester !== chat.conversation.currentUserId} onRespond={respondPickup} />
                                </article>
                              </div>
                            );
                          }
                          if (event.type === "offer")
                            return (
                              <div key={`offer-${offer.id}`}>
                                {showDate && (
                                  <p className="messages-date">{date}</p>
                                )}
                                <OfferNegotiation
                                  offer={offer}
                                  listing={item}
                                  currentUserId={
                                    chat.conversation.currentUserId
                                  }
                                  participant={chat.conversation.participant}
                                  onOfferUpdated={chat.updateOffer}
                                />
                                <Link
                                  to={`/offers/${encodeURIComponent(offer.id)}`}
                                >
                                  View offer details
                                </Link>
                                {["REJECTED", "EXPIRED"].includes(
                                  offer.status,
                                ) &&
                                  item?.id &&
                                  item.status === "AVAILABLE" &&
                                  String(
                                    item.listingType || "",
                                  ).toLowerCase() === "for sale" &&
                                  Number(item.price) > 0 &&
                                  String(chat.conversation.currentUserId) ===
                                    String(offer.buyerId) && (
                                    <Link
                                      to={`/items/${encodeURIComponent(item.id)}`}
                                    >
                                      Make another offer
                                    </Link>
                                  )}
                              </div>
                            );
                          if (event.type === "accepted")
                            return formattedAgreedPrice ? (
                              <div key={`accepted-${offer.id}`}>
                                {showDate && (
                                  <p className="messages-date">{date}</p>
                                )}
                                <article
                                  className="offer-accepted-card"
                                  aria-label="Offer accepted"
                                >
                                  <div className="offer-accepted-card__eyebrow">
                                    <Tag size={15} aria-hidden="true" />
                                    <span>Offer accepted</span>
                                  </div>
                                  <p className="offer-accepted-card__price">
                                    {formattedAgreedPrice}
                                  </p>
                                  <p className="offer-accepted-card__listing-price">
                                    {formattedListingPrice
                                      ? `Listing price ${formattedListingPrice}`
                                      : "Listing price unavailable"}
                                    {" · Campus pickup"}
                                  </p>
                                  <p className="offer-accepted-card__agreement">
                                    You and {chat.conversation.participant.name}{" "}
                                    agreed on {formattedAgreedPrice}. Propose
                                    pickup in chat.
                                  </p>
                                  <p className="offer-accepted-card__note">
                                    Accepting an offer does not mark the item as
                                    sold.
                                  </p>
                                  <button
                                    type="button"
                                    className="offer-accepted-card__button"
                                    onClick={arrangePickup}
                                  >
                                    Proposed pickup
                                  </button>
                                </article>
                              </div>
                            ) : null;
                          const { message } = event;
                          const outgoing =
                            message.senderId ===
                            chat.conversation.currentUserId;
                          return (
                            <div key={`message-${message.id}`}>
                              {showDate && (
                                <p className="messages-date">{date}</p>
                              )}
                              <div
                                className={`messages-message-row ${outgoing ? "outgoing" : "incoming"}`}
                              >
                                <div
                                  className={`messages-bubble ${outgoing ? "outgoing" : "incoming"}`}
                                >
                                  <p>{message.content}</p>
                                  <time dateTime={message.sentAt}>
                                    {timeLabel(message.sentAt)}
                                  </time>
                                </div>
                                {!outgoing && !reportedMessageIds.includes(message.id) && (
                                  <button
                                    type="button"
                                    className="messages-report-trigger"
                                    onClick={() => {
                                      setReportTarget(message);
                                      setReportReason("");
                                      setReportDetails("");
                                      setReportError("");
                                    }}
                                    aria-label="Report message"
                                  >
                                    Report
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {newMessages && (
                        <button
                          type="button"
                          className="messages-new"
                          onClick={bottom}
                        >
                          New messages ↓
                        </button>
                      )}
                      <form
                        className="messages-composer"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void chat.send();
                        }}
                      >
                        {chat.sendError && (
                          <p role="alert" className="messages-error">
                            {chat.sendError}
                          </p>
                        )}
                        <label className="messages-input">
                          <span className="messages-sr-only">
                            Write a message
                          </span>
                          <textarea
                            ref={composerInput}
                            placeholder="Write a message…"
                            value={chat.draft}
                            onChange={(event) =>
                              chat.setDraft(event.target.value)
                            }
                            maxLength={5000}
                            disabled={chat.sending}
                            rows={2}
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={chat.sending || !chat.draft.trim()}
                        >
                          {chat.sending ? "Sending…" : "Send"}
                        </button>
                        <span className="messages-character-count">
                          {chat.draft.length}/5000 · Propose pickups in
                          messages.
                        </span>
                      </form>
                    </>
                  )
                )}
              </>
            )}
          </section>
        </div>
      </main>
      {pickupFormConversation === conversationId && conversationId && (
        <PickupForm
          key={conversationId}
          onClose={() => setPickupFormConversation(null)}
          onSubmit={submitPickup}
        />
      )}
      {reportedMessageIdsError && conversationId && (
        <p className="messages-error" role="status">{reportedMessageIdsError}</p>
      )}
      {reportTarget && (
        <div className="messages-report-backdrop">
          <section
            className={`messages-report-dialog${reportSubmitted ? " messages-report-dialog--confirmation" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="messages-report-title"
          >
            {reportSubmitted ? (
              <div className="messages-report-confirmation">
                <span>Done</span>
                <h2 id="messages-report-title">Report submitted</h2>
                <p>
                  Your report is in the moderation queue. The reported person
                  will not see who reported them.
                </p>
                <button type="button" onClick={closeReportDialog}>
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={submitMessageReport} noValidate>
                <h2 id="messages-report-title">Report a message</h2>
                <p className="messages-report-privacy">
                  Your report is private. The other member will not see who
                  reported them.
                </p>
                <div className="messages-report-selected">
                  <span>Selected message</span>
                  <p>“{reportTarget.content}”</p>
                </div>
                <label className="messages-report-field">
                  <span>
                    Reason <b aria-hidden="true">*</b>
                  </span>
                  <select
                    autoFocus
                    required
                    value={reportReason}
                    onChange={(event) => {
                      setReportReason(event.target.value);
                      setReportError("");
                    }}
                  >
                    <option value="">Select a reason</option>
                    <option value="Harassment or bullying">
                      Harassment or bullying
                    </option>
                    <option value="Threats or intimidation">
                      Threats or intimidation
                    </option>
                    <option value="Scam or fraud">Scam or fraud</option>
                    <option value="Inappropriate content">
                      Inappropriate content
                    </option>
                    <option value="Spam">Spam</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                <label className="messages-report-field">
                  <span>What happened? <b aria-hidden="true">*</b></span>
                  <input
                    value={reportDetails}
                    onChange={(event) => {
                      setReportDetails(event.target.value);
                      setReportError("");
                    }}
                    maxLength={2000}
                    required
                  />
                </label>
                <p className="messages-report-hint">
                  Include context that will help a moderator review the report.
                </p>
                {reportError && (
                  <p className="messages-report-error" role="alert">
                    {reportError}
                  </p>
                )}
                <div className="messages-report-actions">
                  <button
                    type="button"
                    onClick={closeReportDialog}
                    disabled={reportSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reportSubmitting}
                  >
                    {reportSubmitting ? "Submitting…" : "Submit report"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
      <Footer />
    </div>
  );
}
