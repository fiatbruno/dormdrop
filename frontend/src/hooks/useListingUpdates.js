import { useEffect, useLayoutEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";
import { websocketUrl } from "../api/messagingApi";
import { tokenExpiresAt } from "../auth/session";
import useAuth from "./useAuth";

export default function useListingUpdates(onUpdate) {
  const { token } = useAuth();
  const callback = useRef(onUpdate);
  useLayoutEffect(() => { callback.current = onUpdate; }, [onUpdate]);

  useEffect(() => {
    if (!token) return undefined;
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
        client.subscribe("/topic/listings", () => {
          if (active) callback.current();
        });
        callback.current();
      },
    });
    client.activate();
    // Also recover from missed events or a temporarily unavailable connection.
    const timer = window.setInterval(() => callback.current(), 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
      void client.deactivate();
    };
  }, [token]);
}
