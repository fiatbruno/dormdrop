package edu.augustana.csc305.project.security;

import edu.augustana.csc305.project.repository.UserRepository;
import jakarta.annotation.PreDestroy;
import org.bson.types.ObjectId;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;
import org.springframework.web.socket.handler.WebSocketHandlerDecoratorFactory;
import java.util.concurrent.*;
import java.util.Map;

/** Closes sockets at token expiry and when the shared database role version changes. */
@Component
public class WebSocketSessions implements WebSocketHandlerDecoratorFactory {
    private record Identity(ObjectId userId, long version) { }
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, Identity> identities = new ConcurrentHashMap<>();
    private final Map<String, ScheduledFuture<?>> expirations = new ConcurrentHashMap<>();
    private final UserRepository users;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(runnable -> {
        Thread thread = new Thread(runnable, "websocket-expiration");
        thread.setDaemon(true);
        return thread;
    });

    public WebSocketSessions(UserRepository users) {
        this.users = users;
        scheduler.scheduleWithFixedDelay(this::checkRoles, 1, 1, TimeUnit.SECONDS);
    }

    public void registerUser(String sessionId, ObjectId userId, long version) {
        identities.put(sessionId, new Identity(userId, version));
    }

    public void disconnectUser(ObjectId userId) {
        identities.forEach((sessionId, identity) -> {
            if (identity.userId().equals(userId)) close(sessionId);
        });
    }

    // Every instance checks durable version numbers. If the database is unavailable,
    // close authenticated sessions rather than continuing with unverifiable permissions.
    void checkRoles() {
        identities.forEach((sessionId, identity) -> {
            try {
                var user = users.findById(identity.userId());
                if (user.isEmpty() || user.get().getRoleVersion() != identity.version()) close(sessionId);
            } catch (RuntimeException ex) { close(sessionId); }
        });
    }

    private void close(String sessionId) {
        WebSocketSession session = sessions.get(sessionId);
        if (session != null) {
            try { session.close(CloseStatus.POLICY_VIOLATION); }
            catch (java.io.IOException ignored) { /* Transport already closed. */ }
        }
    }

    public void expireAt(String sessionId, long expiresAt) {
        ScheduledFuture<?> task = scheduler.schedule(() -> close(sessionId),
                Math.max(0, expiresAt - System.currentTimeMillis()), TimeUnit.MILLISECONDS);
        ScheduledFuture<?> old = expirations.put(sessionId, task);
        if (old != null) old.cancel(false);
    }

    @Override
    public WebSocketHandler decorate(WebSocketHandler handler) {
        return new WebSocketHandlerDecorator(handler) {
            @Override public void afterConnectionEstablished(WebSocketSession session) throws Exception {
                sessions.put(session.getId(), session);
                expireAt(session.getId(), System.currentTimeMillis() + 10000);
                super.afterConnectionEstablished(session);
            }
            @Override public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
                sessions.remove(session.getId());
                identities.remove(session.getId());
                ScheduledFuture<?> task = expirations.remove(session.getId());
                if (task != null) task.cancel(false);
                super.afterConnectionClosed(session, status);
            }
        };
    }

    @PreDestroy public void stop() { scheduler.shutdownNow(); }
}
