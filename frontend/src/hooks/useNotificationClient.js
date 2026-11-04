import { useEffect, useLayoutEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";
import { websocketUrl } from "../api/messagingApi";
import { tokenExpiresAt } from "../auth/session";
import useAuth from "./useAuth";

let activeToken = null;
let seenEventIds = new Set();

export default function useNotificationClient(onNotification) {
  const { token } = useAuth();
  const callback = useRef(onNotification);
  useLayoutEffect(() => {
    callback.current = onNotification;
  }, [onNotification]);

  useEffect(() => {
    if (!token) {
      activeToken = null;
      seenEventIds = new Set();
      window.dispatchEvent(new Event("dormdrop:notification-session-cleared"));
      return undefined;
    }

    if (activeToken !== token) {
      activeToken = token;
      seenEventIds = new Set();
      window.dispatchEvent(new Event("dormdrop:notification-session-cleared"));
    }

    let active = true;
    const client = new Client({
      brokerURL: websocketUrl(),
      reconnectDelay: 4000,
      connectionTimeout: 10000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      beforeConnect: () => {
        if (tokenExpiresAt(token) <= Date.now()) {
          void client.deactivate();
          return;
        }
        client.connectHeaders = { Authorization: `Bearer ${token}` };
      },
      onConnect: () => {
        if (!active) return;
        client.subscribe("/user/queue/notifications", (frame) => {
          if (!active || activeToken !== token) return;
          let event;
          try {
            event = JSON.parse(frame.body);
          } catch {
            return;
          }
          const notification = event.notification || event;
          const eventId =
            event.eventId ||
            event.notificationId ||
            notification.id ||
            event.id;
          if (!eventId || seenEventIds.has(String(eventId))) return;
          seenEventIds.add(String(eventId));
          if (seenEventIds.size > 500) {
            seenEventIds = new Set([...seenEventIds].slice(-250));
          }
          callback.current(notification);
          window.dispatchEvent(new Event("dormdrop:notifications-updated"));
          window.dispatchEvent(
            new CustomEvent("dormdrop:notification-received", {
              detail: notification,
            }),
          );
        });
        window.dispatchEvent(new Event("dormdrop:notifications-reconnected"));
      },
    });
    client.activate();
    return () => {
      active = false;
      void client.deactivate();
    };
  }, [token]);
}
