import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Footer from "../../components/Footer/Footer";
import Navbar from "../../components/Navbar/Navbar";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../api/notificationsApi";
import "./Notifications.css";

const PAGE_SIZE = 20;
const REFRESH_INTERVAL_MS = 15_000;

function notificationTitle(type) {
  switch (type) {
    case "OFFER_ACCEPTED":
      return "Your offer was accepted";
    case "OFFER_REJECTED":
      return "Your offer was declined";
    case "OFFER_COUNTERED":
      return "You received a counteroffer";
    case "OFFER_SENT":
    case "OFFER_SUBMITTED":
      return "You sent an offer";
    case "OFFER_EXPIRED":
      return "Your offer expired";
    case "MESSAGE_CREATED":
      return "New message";
    default:
      return "DormDrop update";
  }
}

function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [filter, setFilter] = useState("all");
  const [markingAll, setMarkingAll] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    setError("");
    setRefreshVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    let active = true;

    getNotifications(page, PAGE_SIZE)
      .then((result) => {
        if (!Array.isArray(result.items)) {
          throw new Error("The notification response is invalid.");
        }
        if (!active) return;
        setItems((previous) =>
          page === 0 ? result.items : [...previous, ...result.items],
        );
        setTotal(result.total);
        setUnreadCount(result.unreadCount);
        setError("");
      })
      .catch(() => {
        if (active) {
          setError("Couldn't load your notifications. Please try again.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, refreshVersion]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible" && page === 0) refresh();
    };
    const interval = window.setInterval(refreshWhenVisible, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [page, refresh]);

  async function markRead(notification) {
    if (notification.readAt || pendingIds.has(notification.id)) return;
    setActionError("");
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
      setUnreadCount((count) => Math.max(0, count - 1));
      window.dispatchEvent(new Event("dormdrop:notifications-updated"));
    } catch {
      setActionError("Couldn't mark that notification as read. Please retry.");
    } finally {
      setPendingIds((previous) => {
        const next = new Set(previous);
        next.delete(notification.id);
        return next;
      });
    }
  }

  async function markAllRead() {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    setActionError("");
    try {
      const { readIds, failedIds } = await markAllNotificationsRead();
      const readIdSet = new Set(readIds);
      setItems((previous) =>
        previous.map((item) =>
          readIdSet.has(item.id)
            ? { ...item, readAt: new Date().toISOString() }
            : item,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - readIds.length));
      window.dispatchEvent(new Event("dormdrop:notifications-updated"));
      if (failedIds.length) {
        setActionError(
          `${failedIds.length} notification${failedIds.length === 1 ? "" : "s"} couldn't be marked as read. Please retry.`,
        );
      }
    } catch {
      setActionError("Couldn't mark all notifications as read. Please retry.");
    } finally {
      setMarkingAll(false);
    }
  }

  const hasMore = items.length < total;
  const visibleItems =
    filter === "unread" ? items.filter((item) => !item.readAt) : items;

  return (
    <div className="notifications-shell">
      <Navbar showSearch={false} />
      <main className="notifications-page">
        <header className="notifications-heading">
          <div>
            <h1>Your notifications</h1>
            <p>Stay up to date on your offers and activity.</p>
          </div>
          <span className="notifications-count" aria-live="polite">
            {unreadCount} unread
          </span>
          <button
            type="button"
            className="notifications-mark-all"
            onClick={() => void markAllRead()}
            disabled={markingAll || unreadCount === 0}
          >
            {markingAll ? "Marking…" : "Mark all as read"}
          </button>
        </header>

        <div
          className="notifications-filters"
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
            Unread ({unreadCount})
          </button>
        </div>

        {actionError && (
          <p className="notifications-error" role="alert">
            {actionError}
          </p>
        )}

        {error ? (
          <div className="notifications-state" role="alert">
            <p>{error}</p>
            <button type="button" onClick={refresh}>
              Try again
            </button>
          </div>
        ) : loading && items.length === 0 ? (
          <div className="notifications-state" role="status">
            Loading notifications…
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="notifications-state">
            <h2>
              {filter === "unread" ? "You’re all caught up" : "No notifications yet"}
            </h2>
            <p>Updates about your offers will show up here.</p>
          </div>
        ) : (
          <>
            <ol className="notifications-list">
              {visibleItems.map((notification) => {
                const pending = pendingIds.has(notification.id);
                const title = notificationTitle(notification.type);
                return (
                  <li
                    className={`notification-card${notification.readAt ? "" : " notification-card--unread"}`}
                    key={notification.id}
                  >
                    <div className="notification-card__content">
                      <div className="notification-card__heading">
                        <h2>{title}</h2>
                        {!notification.readAt && (
                          <span className="notification-card__unread">
                            Unread
                          </span>
                        )}
                      </div>
                      <p>
                        {notification.payload?.message ||
                          "There’s an update about your DormDrop activity."}
                      </p>
                      {notification.payload?.price != null && (
                        <p className="notification-card__price">
                          Offer:{" "}
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: "USD",
                            maximumFractionDigits: 2,
                          }).format(Number(notification.payload.price))}
                        </p>
                      )}
                      <time dateTime={notification.createdAt}>
                        {dateLabel(notification.createdAt)}
                      </time>
                    </div>
                    <div className="notification-card__actions">
                      {notification.listingId && (
                        <Link to={`/items/${encodeURIComponent(notification.listingId)}`}>
                          View listing
                        </Link>
                      )}
                      {!notification.readAt && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => void markRead(notification)}
                        >
                          {pending ? "Saving…" : "Mark as read"}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            {hasMore && (
              <button
                type="button"
                className="notifications-load-more"
                disabled={loading}
                onClick={() => {
                  setLoading(true);
                  setError("");
                  setPage((current) => current + 1);
                }}
              >
                {loading ? "Loading…" : "Load older notifications"}
              </button>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
