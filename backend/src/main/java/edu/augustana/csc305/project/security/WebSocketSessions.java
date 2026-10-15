package edu.augustana.csc305.project.security;

import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;
import org.springframework.web.socket.handler.WebSocketHandlerDecoratorFactory;
import java.util.concurrent.*;
import java.util.Map;

/** Closes authenticated sockets when their JWT expires, even while idle. */
@Component
public class WebSocketSessions implements WebSocketHandlerDecoratorFactory {
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, ScheduledFuture<?>> expirations = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(runnable -> {
        Thread thread = new Thread(runnable, "websocket-expiration");
        thread.setDaemon(true);
        return thread;
    });

    public void expireAt(String sessionId, long expiresAt) {
        ScheduledFuture<?> task = scheduler.schedule(() -> {
            WebSocketSession session = sessions.get(sessionId);
            if (session != null) {
                try { session.close(CloseStatus.POLICY_VIOLATION); }
                catch (java.io.IOException ignored) { /* Transport already closed. */ }
            }
        }, Math.max(0, expiresAt - System.currentTimeMillis()), TimeUnit.MILLISECONDS);
        ScheduledFuture<?> old = expirations.put(sessionId, task);
        if (old != null) old.cancel(false);
    }

    @Override
    public WebSocketHandler decorate(WebSocketHandler handler) {
        return new WebSocketHandlerDecorator(handler) {
            @Override public void afterConnectionEstablished(WebSocketSession session) throws Exception {
                sessions.put(session.getId(), session);
                // Unauthenticated connections must authenticate promptly.
                expireAt(session.getId(), System.currentTimeMillis() + 10000);
                super.afterConnectionEstablished(session);
            }
            @Override public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
                sessions.remove(session.getId());
                ScheduledFuture<?> task = expirations.remove(session.getId());
                if (task != null) task.cancel(false);
                super.afterConnectionClosed(session, status);
            }
        };
    }

    @PreDestroy public void stop() { scheduler.shutdownNow(); }
}
