import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import ListingImage from "../../components/ListingImage";
import useMessaging from "../../hooks/useMessaging";
import "./Messages.css";
import OfferCard from "../../components/OfferCard/OfferCard";

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
  const scroll = useRef(null);
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

  return (
    <div className="messages-shell">
      <Navbar showSearch={false} />
      <main className="messages-page">
          <div className="offer-preview-controls">
            <span>Preview offer status:</span>

            <button
              type="button"
              onClick={() => setOfferStatus("ACCEPTED")}
            >
              Offer Accepted
            </button>

            <button
              type="button"
              onClick={() => setOfferStatus("DECLINED")}
            >
              Offer Declined
            </button>
          </div>
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
                        {chat.messages.length === 0 && (
                          <p className="messages-state">
                            Say hello and ask about the item.
                          </p>
                        )}
                        {chat.messages.map((message, index) => {
                          const outgoing =
                            message.senderId ===
                            chat.conversation.currentUserId;
                          const showDate =
                            !index ||
                            dateLabel(message.sentAt) !==
                              dateLabel(chat.messages[index - 1].sentAt);
                          return (
                            <div key={message.id}>
                              {showDate && (
                                <p className="messages-date">
                                  {dateLabel(message.sentAt)}
                                </p>
                              )}
                              <div
                                className={`messages-bubble ${outgoing ? "outgoing" : "incoming"}`}
                              >
                                <p>{message.content}</p>
                                <time dateTime={message.sentAt}>
                                  {timeLabel(message.sentAt)}
                                </time>
                              </div>
                            </div>
                          );
                        })}

                    <OfferCard
                      offer={offer}
                      onArrangePickup={() => {
                        chat.setDraft(
                          "Hi! When and where would you like to meet for pickup?"
                        );
                      }}
                      onMakeAnotherOffer={() => {
                        // Connect this to the actual offer submission flow later.
                        chat.setDraft(
                          "Hi! I'd like to make another offer. Would you consider a different price?"
                        );
                      }}
                    />
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
      <Footer />
    </div>
  );
}
