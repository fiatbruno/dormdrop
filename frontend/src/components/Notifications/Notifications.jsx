
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Mail, Tag, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../api/notificationsApi";
import "./Notifications.css";

export default function Notifications() {
  const navigate = useNavigate();
  const containerRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await getNotifications();

      if (!Array.isArray(data)) {
        throw new Error("Invalid notifications response");
      }

      setNotifications(data);
      setError("");
    } catch {
      setError("Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (open) void loadNotifications();
  }, [open, loadNotifications]);

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
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const unreadCount = notifications.filter(
    (notification) => !notification.read
  ).length;

  const unreadMessageCount = notifications.filter(
    (notification) =>
      notification.type === "MESSAGE" && !notification.read
  ).length;

  const visibleNotifications =
    filter === "unread"
      ? notifications.filter((notification) => !notification.read)
      : notifications;

  async function handleMarkAllRead() {
    if (updating) return;

    setUpdating(true);

    try {
      await markAllNotificationsRead();

      setNotifications((previous) =>
        previous.map((notification) => ({
          ...notification,
          read: true,
        }))
      );

      setError("");
    } catch {
      setError("Could not mark notifications as read.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleNotificationClick(notification) {
    if (updating) return;

    if (!notification.read) {
      setUpdating(true);

      try {
        await markNotificationRead(notification.id);

        setNotifications((previous) =>
          previous.map((item) =>
            item.id === notification.id
              ? { ...item, read: true }
              : item
          )
        );
      } catch {
        setError("Could not mark notification as read.");
        setUpdating(false);
        return;
      }

      setUpdating(false);
    }

    setOpen(false);

    if (notification.conversationId) {
      navigate(`/messages/${notification.conversationId}`);
    } else {
      navigate("/messages");
    }
  }

  return (
    <div className="dd-notifications" ref={containerRef}>
      <button
        type="button"
        className="dd-notifications-bell"
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((previous) => !previous)}
      >
        <Bell size={20} />

        {unreadCount > 0 && (
          <span className="dd-notifications-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="dd-notifications-panel"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="dd-notifications-header">
            <h2>Notifications</h2>

            <button
              type="button"
              className="dd-notifications-mark-all"
              onClick={handleMarkAllRead}
              disabled={updating || unreadCount === 0}
            >
              Mark all as read
            </button>

            <button
              type="button"
              className="dd-notifications-close"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
            >
              <X size={17} />
            </button>
          </div>

          <div className="dd-notifications-tabs">
            <button
              type="button"
              className={filter === "all" ? "active" : ""}
              onClick={() => setFilter("all")}
            >
              All
            </button>

            <button
              type="button"
              className={filter === "unread" ? "active" : ""}
              onClick={() => setFilter("unread")}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {error && (
            <div className="dd-notifications-error" role="alert">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => void loadNotifications()}
              >
                Retry
              </button>
            </div>
          )}

          <div className="dd-notifications-list">
            {loading ? (
              <p className="dd-notifications-empty">
                Loading notifications...
              </p>
            ) : visibleNotifications.length === 0 && !error ? (
              <p className="dd-notifications-empty">
                {filter === "unread"
                  ? "No unread notifications."
                  : "No notifications yet."}
              </p>
            ) : (
              visibleNotifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className={`dd-notification-item ${
                    !notification.read ? "unread" : ""
                  }`}
                  disabled={updating}
                  onClick={() =>
                    void handleNotificationClick(notification)
                  }
                >
                  <span className="dd-notification-icon">
                    {notification.type === "MESSAGE" ? (
                      <Mail size={16} />
                    ) : (
                      <Tag size={16} />
                    )}
                  </span>

                  <span className="dd-notification-content">
                    <strong>{notification.title}</strong>
                    <span>{notification.description}</span>
                    <small>
                      {notification.createdAt
                        ? new Date(
                            notification.createdAt
                          ).toLocaleString()
                        : ""}
                    </small>
                  </span>

                  {!notification.read && (
                    <span className="dd-notification-dot" />
                  )}
                </button>
              ))
            )}
          </div>

          <div className="dd-notifications-footer">
            {unreadMessageCount} unread message notifications
            {" · "}
            Offers and messages from your campus community
          </div>
        </div>
      )}
    </div>
  );
}
