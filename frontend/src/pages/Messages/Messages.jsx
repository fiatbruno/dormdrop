import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Tag } from "lucide-react";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import ListingImage from "../../components/ListingImage";
import useMessaging from "../../hooks/useMessaging";
import { reportMessage } from "../../api/messagingApi";
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
function priceLabel(item) {
  if (item.listingType === "Free / Donate") return "Free";
  if (item.listingType === "Trade") return "Trade";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(item.price);
}

export default function Messages() {
  const { conversationId } = useParams();
  const chat = useMessaging(conversationId);
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [newMessages, setNewMessages] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportError, setReportError] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const scroll = useRef(null);
  const composerInput = useRef(null);
  const nearBottom = useRef(true);
  const previous = useRef({ id: null, last: null, sent: 0 });
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
  }, [chat.messages, conversationId, chat.sentVersion]);

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
  const acceptedAt = offer?.history?.findLast((entry) => entry.action === "ACCEPTED")?.createdAt
    || offer?.updatedAt || offer?.createdAt;
  const timeline = [
    ...chat.messages.map((message) => ({ type: "message", at: message.sentAt, message })),
    ...(offer ? [{ type: "offer", at: offer.createdAt || offer.history?.[0]?.createdAt }] : []),
    ...(offerAccepted ? [{ type: "accepted", at: acceptedAt }] : []),
  ].sort((a, b) => {
    const first = Date.parse(a.at);
    const second = Date.parse(b.at);
    const firstTime = Number.isFinite(first) ? first : -Infinity;
    const secondTime = Number.isFinite(second) ? second : -Infinity;
    if (firstTime !== secondTime) return firstTime - secondTime;
    const order = { offer: 0, accepted: 1, message: 2 };
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
    composerInput.current?.focus();
  }

  function closeReportDialog() {
    if (reportSubmitting) return;
    setReportTarget(null);
    setReportReason("");
    setCustomReason("");
    setReportDetails("");
    setReportError("");
    setReportSubmitted(false);
  }

  async function submitMessageReport(event) {
    event.preventDefault();
    const reason = reportReason === "Other" ? customReason.trim() : reportReason;
    if (!reason) {
      setReportError("Select or enter a reason before submitting.");
      return;
    }

    setReportSubmitting(true);
    setReportError("");
    try {
      await reportMessage(conversationId, reportTarget.id, {
        reason,
        details: reportDetails.trim() || undefined,
      });
      setReportSubmitted(true);
    } catch (error) {
      setReportError(
        error.response?.data?.message ||
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
          <div className="messages-connection">
            <span role="status">{chat.connection}</span>
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
                        {timeline.length === 0 && (
                          <p className="messages-state">Say hello and ask about the item.</p>
                        )}
                        {timeline.map((event, index) => {
                          const date = Number.isFinite(Date.parse(event.at)) ? dateLabel(event.at) : "";
                          const previousDate = Number.isFinite(Date.parse(timeline[index - 1]?.at))
                            ? dateLabel(timeline[index - 1].at) : "";
                          const showDate = date && date !== previousDate;
                          if (event.type === "offer") return (
                            <div key={`offer-${offer.id}`}>
                              {showDate && <p className="messages-date">{date}</p>}
                              <OfferNegotiation
                                offer={offer}
                                listing={item}
                                currentUserId={chat.conversation.currentUserId}
                                participant={chat.conversation.participant}
                                onOfferUpdated={chat.updateOffer}
                              />
                              <Link to={`/offers/${encodeURIComponent(offer.id)}`}>
                                View offer details
                              </Link>
                              {["REJECTED", "EXPIRED"].includes(offer.status) && item?.id &&
                                item.status === "AVAILABLE" &&
                                String(item.listingType || "").toLowerCase() === "for sale" && Number(item.price) > 0 &&
                                String(chat.conversation.currentUserId) === String(offer.buyerId) && (
                                <Link to={`/items/${encodeURIComponent(item.id)}`}>
                                  Make another offer
                                </Link>
                              )}
                            </div>
                          );
                          if (event.type === "accepted") return formattedAgreedPrice ? (
                            <div key={`accepted-${offer.id}`}>
                              {showDate && <p className="messages-date">{date}</p>}
                              <article className="offer-accepted-card" aria-label="Offer accepted">
                                <div className="offer-accepted-card__eyebrow">
                                  <Tag size={15} aria-hidden="true" />
                                  <span>Offer accepted</span>
                                </div>
                                <p className="offer-accepted-card__price">{formattedAgreedPrice}</p>
                                <p className="offer-accepted-card__listing-price">
                                  {formattedListingPrice ? `Listing price ${formattedListingPrice}` : "Listing price unavailable"}
                                  {" · Campus pickup"}
                                </p>
                                <p className="offer-accepted-card__agreement">
                                  You and {chat.conversation.participant.name} agreed on {formattedAgreedPrice}. Arrange pickup in chat.
                                </p>
                                <p className="offer-accepted-card__note">Accepting an offer does not mark the item as sold.</p>
                                <button type="button" className="offer-accepted-card__button" onClick={arrangePickup}>
                                  Arrange pickup
                                </button>
                              </article>
                            </div>
                          ) : null;
                          const { message } = event;
                          const outgoing = message.senderId === chat.conversation.currentUserId;
                          return (
                            <div key={`message-${message.id}`}>
                              {showDate && <p className="messages-date">{date}</p>}
                              <div className={`messages-message-row ${outgoing ? "outgoing" : "incoming"}`}>
                                <div className={`messages-bubble ${outgoing ? "outgoing" : "incoming"}`}>
                                  <p>{message.content}</p>
                                  <time dateTime={message.sentAt}>{timeLabel(message.sentAt)}</time>
                                </div>
                                <button
                                  type="button"
                                  className="messages-report-trigger"
                                  onClick={() => {
                                    setReportTarget(message);
                                    setReportError("");
                                  }}
                                  aria-label={`Report message from ${outgoing ? "you" : chat.conversation.participant.name}`}
                                >
                                  Report
                                </button>
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
                          {chat.draft.length}/5000 · Arrange pickups in
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
      {reportTarget && (
        <div className="messages-report-backdrop">
          <section
            className="messages-report-dialog"
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
              <form onSubmit={submitMessageReport}>
                <h2 id="messages-report-title">Report a message</h2>
                <p className="messages-report-privacy">
                  Your report is private. The other member will not see who
                  reported them.
                </p>
                <div className="messages-report-selected">
                  <span>Selected message</span>
                  <p>{reportTarget.content}</p>
                </div>
                <label className="messages-report-field">
                  <span>Reason <b aria-hidden="true">*</b></span>
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
                    <option value="Harassment or bullying">Harassment or bullying</option>
                    <option value="Threats or intimidation">Threats or intimidation</option>
                    <option value="Scam or fraud">Scam or fraud</option>
                    <option value="Inappropriate content">Inappropriate content</option>
                    <option value="Spam">Spam</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                {reportReason === "Other" && (
                  <label className="messages-report-field">
                    <span>Enter a reason <b aria-hidden="true">*</b></span>
                    <input
                      required
                      maxLength={500}
                      value={customReason}
                      onChange={(event) => setCustomReason(event.target.value)}
                      placeholder="Briefly explain your reason"
                    />
                  </label>
                )}
                <label className="messages-report-field">
                  <span>What happened? (optional)</span>
                  <textarea
                    maxLength={2000}
                    value={reportDetails}
                    onChange={(event) => setReportDetails(event.target.value)}
                    placeholder="Include context that will help a moderator review the report."
                    rows={3}
                  />
                </label>
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
                    disabled={
                      reportSubmitting ||
                      !reportReason ||
                      (reportReason === "Other" && !customReason.trim())
                    }
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
