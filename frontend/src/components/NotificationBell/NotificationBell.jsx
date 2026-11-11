import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Mail, Tag, X } from "lucide-react";
import { Link } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import useNotificationClient from "../../hooks/useNotificationClient";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../api/notificationsApi";
import useUnreadNotificationCount from "../../hooks/useUnreadNotificationCount";
import useUnreadMessages from "../../hooks/useUnreadMessages";
import { markRead as markConversationRead } from "../../api/messagingApi";
import {
  notificationBody,
  notificationTarget,
  notificationTitle,
} from "../../utils/notifications";
import "./NotificationBell.css";

const PREVIEW_SIZE = 5;

function notificationIcon(type) {
  return type === "MESSAGE_CREATED" ? Mail : Tag;
}

function relativeTime(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    timestamp,
  );
}

export default function NotificationBell() {
  const { token } = useAuth();
  return <NotificationBellContent key={token || "signed-out"} />;
}

function NotificationBellContent() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [markingAll, setMarkingAll] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const rootRef = useRef(null);
  const { count, error: countError } = useUnreadNotificationCount();
  const { count: messageCount, conversations, error: messageError, refresh: refreshMessages } = useUnreadMessages();
  const totalUnread = count + messageCount;
  const messageItems = conversations.map((conversation) => ({
    id: `message:${conversation.id}`,
    type: "MESSAGE_CREATED",
    conversationId: conversation.id,
    createdAt: conversation.lastMessageAt,
    payload: { message: `${conversation.participant?.name || "Someone"}: ${conversation.lastMessagePreview || `${conversation.unreadCount} unread message${conversation.unreadCount === 1 ? "" : "s"}`}` },
  }));
  const visibleItems = [...items, ...messageItems]
    .filter((item) => filter !== "unread" || !item.readAt)
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
    .slice(0, PREVIEW_SIZE);
  const unreadInPreview = visibleItems.filter((item) => !item.readAt).length;

  const handleLiveNotice = useCallback(() => {
    setRefreshVersion((version) => version + 1);
  }, []);
  useNotificationClient(handleLiveNotice);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    getNotifications(0, PREVIEW_SIZE, filter === "unread")
      .then((result) => {
        if (active) setItems(Array.isArray(result.items) ? result.items : []);
      })
      .catch(() => {
        if (active) setError("Couldn't load notifications.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, refreshVersion, filter]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function markRead(notification) {
    if (notification.readAt || pendingIds.has(notification.id)) return;
    if (notification.type === "MESSAGE_CREATED" && notification.conversationId) {
      try {
        await markConversationRead(notification.conversationId);
        window.dispatchEvent(new Event("dormdrop:messages-updated"));
      } catch {
        setError("Couldn't mark the conversation as read. Please retry.");
      }
      return;
    }
    setPendingIds((previous) => new Set(previous).add(notification.id));
    try {
      const updated = await markNotificationRead(notification.id);
      setItems((previous) =>
        previous.map((item) =>
          item.id === notification.id
            ? { ...item, readAt: updated.readAt || new Date().toISOString() }
            : item,
        ),
      );
      window.dispatchEvent(new Event("dormdrop:notifications-updated"));
    } catch {
      setError("Couldn't mark that notification as read. Please retry.");
    } finally {
      setPendingIds((previous) => {
        const next = new Set(previous);
        next.delete(notification.id);
        return next;
      });
    }
  }

  async function markAllRead() {
    if (markingAll || totalUnread === 0) return;
    setMarkingAll(true);
    setError("");
    try {
      const [notificationResult, ...messageResults] = await Promise.allSettled([
        count ? markAllNotificationsRead() : Promise.resolve({ readIds: [], failedIds: [] }),
        ...conversations.map((conversation) => markConversationRead(conversation.id)),
      ]);
      const { readIds, failedIds } = notificationResult.status === "fulfilled"
        ? notificationResult.value : { readIds: [], failedIds: ["notifications"] };

      setItems((previous) =>
        previous.map((item) =>
          readIds.includes(item.id)
            ? { ...item, readAt: new Date().toISOString() }
            : item,
        ),
      );
      window.dispatchEvent(new Event("dormdrop:notifications-updated"));
      window.dispatchEvent(new Event("dormdrop:messages-updated"));
      const failures = failedIds.length + messageResults.filter((result) => result.status === "rejected").length;
      if (failures) {
        setError(
          `${failures} update${failures === 1 ? "" : "s"} couldn't be marked as read. Please try again.`,
        );
      }
    } catch {
      setError("Couldn't mark all notifications as read. Please try again.");
      window.dispatchEvent(new Event("dormdrop:notifications-updated"));
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="notification-bell" ref={rootRef}>
      <button
        type="button"
        className="notification-bell__toggle"
        aria-label={
          countError || messageError
            ? "Notifications, unread count unavailable"
            : `Notifications${totalUnread ? `, ${totalUnread} unread` : ""}`
        }
        aria-expanded={open}
        aria-controls="notification-bell-panel"
        onClick={() => {
          if (!open) {
            setLoading(true);
            setError("");
            void refreshMessages();
          }
          setOpen((value) => !value);
        }}
      >
        <Bell size={20} aria-hidden="true" />
        {totalUnread > 0 && (
          <span className="notification-bell__badge" aria-hidden="true">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>
      {open && (
        <section
          className="notification-bell__panel"
          id="notification-bell-panel"
          aria-label="Notifications"
        >
          <header className="notification-bell__header">
            <h2>Notifications</h2>
            <button
              type="button"
              className="notification-bell__mark-all"
              onClick={() => void markAllRead()}
              disabled={markingAll || totalUnread === 0}
            >
              {markingAll ? "Marking…" : "Mark all as read"}
            </button>
            <button
              type="button"
              className="notification-bell__close"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
            >
              <X size={15} aria-hidden="true" />
            </button>
          </header>
          <div
            className="notification-bell__filters"
            role="group"
            aria-label="Filter notifications"
          >
            <button
              type="button"
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
            >
              All
            </button>
            <button
              type="button"
              aria-pressed={filter === "unread"}
              onClick={() => setFilter("unread")}
            >
              Unread ({totalUnread})
            </button>
          </div>
          {error && (
            <div className="notification-bell__error" role="alert">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setError("");
                  setRefreshVersion((version) => version + 1);
                }}
              >
                Retry
              </button>
            </div>
          )}
          <div className="notification-bell__list">
            {loading ? (
              <p className="notification-bell__state" role="status">
                Loading notifications…
              </p>
            ) : visibleItems.length === 0 ? (
              <p className="notification-bell__state">
                {filter === "unread" || items.length === 0
                  ? "You’re all caught up."
                  : "No notifications to show."}
              </p>
            ) : (
              visibleItems.map((notification) => {
                const Icon = notificationIcon(notification.type);
                const title = notificationTitle(notification.type);
                const body = notificationBody(notification);
                const item = (
                  <>
                    <Icon size={15} aria-hidden="true" />
                    <span className="notification-bell__item-copy">
                      <strong>{title}</strong>
                      {body && (
                        <span className="notification-bell__detail">
                          {body}
                        </span>
                      )}
                      <time dateTime={notification.createdAt}>
                        {relativeTime(notification.createdAt)}
                      </time>
                    </span>
                    {!notification.readAt && (
                      <span className="notification-bell__unread-dot" />
                    )}
                  </>
                );
                return notification.offerId ||
                  notification.conversationId ||
                  notification.listingId ||
                  notificationTarget(notification) !== "/notifications" ? (
                  <Link
                    className={`notification-bell__item${notification.readAt ? "" : " is-unread"}`}
                    key={notification.id}
                    to={notificationTarget(notification)}
                    onClick={() => {
                      void markRead(notification);
                      setOpen(false);
                    }}
                  >
                    {item}
                  </Link>
                ) : (
                  <button
                    className={`notification-bell__item notification-bell__item--button${notification.readAt ? "" : " is-unread"}`}
                    key={notification.id}
                    type="button"
                    disabled={pendingIds.has(notification.id)}
                    onClick={() => void markRead(notification)}
                  >
                    {item}
                  </button>
                );
              })
            )}
          </div>
          <footer className="notification-bell__footer">
            <Link to="/notifications" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
            {unreadInPreview > 0 && (
              <span className="notification-bell__sr-only">
                {unreadInPreview} unread notifications in preview
              </span>
            )}
          </footer>
        </section>
      )}
      <span className="notification-bell__sr-only" aria-live="polite">
        {countError || messageError ? "Unread count unavailable" : `${totalUnread} unread notifications`}
      </span>
    </div>
  );
}
