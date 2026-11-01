
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, RefreshCw } from "lucide-react";

import useAuth from "../../hooks/useAuth";
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
} from "../../api/notificationApi";

import "./NotificationBell.css";

const POLL_INTERVAL = 20000;

function formatTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState(null);

  const containerRef = useRef(null);
  const requestRef = useRef(0);

  useEffect(() => {
    let active = true;
    let busy = false;

    const requestId = ++requestRef.current;

    async function refresh() {
      if (!token || busy) return;

      busy = true;

      try {
        const [items, count] = await Promise.all([
          getNotifications(),
          getUnreadNotificationCount(),
        ]);

        if (!active || requestRef.current !== requestId) {
          return;
        }

        setNotifications(items);
        setUnreadCount(count);
        setError("");
      } catch {
        if (active && requestRef.current === requestId) {
          setError("Couldn't load notifications.");
        }
      } finally {
        busy = false;

        if (active && requestRef.current === requestId) {
          setLoading(false);
        }
      }
    }

    setNotifications([]);
    setUnreadCount(null);
    setLoading(true);
    setError("");

    refresh();

    const interval = window.setInterval(
      refresh,
      POLL_INTERVAL
    );

    function handleFocus() {
      refresh();
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, [token]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function openNotification(notification) {
    if (openingId) return;

    setOpeningId(notification.id);
    setError("");

    try {
      if (!notification.read) {
        await markNotificationAsRead(notification.id);

        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id
              ? { ...item, read: true }
              : item
          )
        );

        // The server remains the source of truth
        // for the unread notification count.
        try {
          const count = await getUnreadNotificationCount();
          setUnreadCount(count);
        } catch {
          setUnreadCount(null);
        }
      }

      setOpen(false);

      if (
        notification.type === "OFFER_RECEIVED" &&
        notification.offerId
      ) {
        navigate(
          `/offers/${encodeURIComponent(notification.offerId)}`
        );
      } else {
        setError(
          "This notification doesn't have an available destination."
        );
        setOpen(true);
      }
    } catch {
      setError(
        "Couldn't mark the notification as read. Please try again."
      );
    } finally {
      setOpeningId(null);
    }
  }

  if (!token) return null;

  return (
    <div
      className="notification-bell-container"
      ref={containerRef}
    >
      <button
        type="button"
        className="notification-bell-button"
        aria-label={
          unreadCount === null
            ? "Notifications"
            : `Notifications, ${unreadCount} unread`
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((previous) => !previous)}
      >
        <Bell size={21} />

        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="notification-dropdown"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="notification-dropdown-header">
            <h2>Notifications</h2>

            <button
              type="button"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>

          {error && (
            <p className="notification-error" role="alert">
              {error}
            </p>
          )}

          {loading ? (
            <p className="notification-empty">
              Loading notifications...
            </p>
          ) : notifications.length === 0 ? (
            <p className="notification-empty">
              No notifications yet.
            </p>
          ) : (
            <div className="notification-list">
              {notifications.map((notification) => (
                <button
                  type="button"
                  key={notification.id}
                  disabled={Boolean(openingId)}
                  onClick={() =>
                    openNotification(notification)
                  }
                  className={`notification-item ${
                    notification.read
                      ? ""
                      : "notification-item-unread"
                  }`}
                >
                  <span className="notification-item-icon">
                    <Bell size={17} />
                  </span>

                  <span className="notification-item-content">
                    <strong>
                      {notification.type === "OFFER_RECEIVED"
                        ? "New offer received"
                        : "Notification"}
                    </strong>

                    <span>
                      {notification.message ||
                        "You have a new notification."}
                    </span>

                    <small>
                      {formatTime(notification.createdAt)}
                    </small>
                  </span>

                  {!notification.read && (
                    <span
                      className="notification-unread-dot"
                      aria-label="Unread"
                    />
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="notification-dropdown-footer">
            <span>
              {unreadCount === null
                ? "Unread count unavailable"
                : `${unreadCount} unread`}
            </span>

            <button
              type="button"
              onClick={() => {
                // Refresh by reopening the component
                // on the next scheduled fetch.
                setOpen(false);
                setOpen(true);
              }}
              aria-label="Close and reopen notifications"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
