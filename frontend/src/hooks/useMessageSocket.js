import { useEffect, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import useAuth from './useAuth';
import { tokenExpiresAt } from '../auth/session';
import { websocketUrl } from '../api/messagingApi';

export default function useMessageSocket(onEvent, onReconnect) {
  const { token } = useAuth();
  const callbacks = useRef({ onEvent, onReconnect });
  callbacks.current = { onEvent, onReconnect };
  const [status, setStatus] = useState('Connecting…');
  useEffect(() => {
    if (!token) return;
    let active = true;
    const client = new Client({
      brokerURL: websocketUrl(), reconnectDelay: 4000,
      connectionTimeout: 10000, heartbeatIncoming: 10000, heartbeatOutgoing: 10000,
      beforeConnect: () => {
        if (tokenExpiresAt(token) <= Date.now()) { void client.deactivate(); return; }
        client.connectHeaders = { Authorization: `Bearer ${token}` };
      },
      onConnect: () => {
        if (!active) return;
        setStatus('Live');
        client.subscribe('/user/queue/messages', frame => {
          try {
            const event = JSON.parse(frame.body);
            if (event.type === 'MESSAGE_CREATED') callbacks.current.onEvent(event);
          } catch { /* Ignore malformed events; REST remains authoritative. */ }
        });
        callbacks.current.onReconnect();
      },
      onWebSocketClose: () => { if (active) setStatus('Reconnecting…'); },
      onStompError: () => { if (active) setStatus('Live updates unavailable'); },
    });
    client.activate();
    return () => { active = false; void client.deactivate(); };
  }, [token]);
  return status;
}
