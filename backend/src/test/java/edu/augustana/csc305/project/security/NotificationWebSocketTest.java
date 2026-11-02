package edu.augustana.csc305.project.security;

import edu.augustana.csc305.project.dto.NotificationResponse;
import edu.augustana.csc305.project.model.PrivateNotification;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.UserRepository;
import edu.augustana.csc305.project.service.NotificationLivePublisher;
import io.jsonwebtoken.JwtException;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.*;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.messaging.simp.user.*;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.*;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class NotificationWebSocketTest {
    private final UserRepository users = mock(UserRepository.class);
    private final JwtService jwt = mock(JwtService.class);
    private final WebSocketSessions sessions = mock(WebSocketSessions.class);
    private final WebSocketAuthInterceptor interceptor = new WebSocketAuthInterceptor(jwt, sessions, new PersistedUserDetailsService(users));
    private final User recipient = new User(new ObjectId(), "Recipient", "recipient@example.edu", "hash");

    private Message<byte[]> message(StompHeaderAccessor headers) {
        headers.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], headers.getMessageHeaders());
    }

    private StompHeaderAccessor connect(String token, long expiresAt) {
        var headers = StompHeaderAccessor.create(StompCommand.CONNECT);
        headers.setSessionId("recipient-session");
        if (token != null) {
            headers.setNativeHeader("Authorization", "Bearer " + token);
            when(jwt.parseToken(token)).thenReturn(io.jsonwebtoken.Jwts.claims().subject(recipient.getEmail())
                    .expiration(new Date(expiresAt)).build());
        }
        when(users.findByEmail(recipient.getEmail())).thenReturn(Optional.of(recipient));
        return headers;
    }

    @Test
    void authenticatedUserCanSubscribeToBothPersonalQueuesButCannotSend() {
        // JWT NumericDate stores whole seconds.
        long expiresAt = (System.currentTimeMillis() / 1000 + 60) * 1000;
        var connected = connect("valid", expiresAt);
        interceptor.preSend(message(connected), null);
        assertEquals(recipient.getEmail(), connected.getUser().getName());
        verify(sessions).expireAt("recipient-session", expiresAt);
        for (String destination : List.of("/user/queue/messages", "/user/queue/notifications")) {
            var subscription = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
            subscription.setUser(connected.getUser());
            subscription.setDestination(destination);
            assertDoesNotThrow(() -> interceptor.preSend(message(subscription), null));
        }
        var send = StompHeaderAccessor.create(StompCommand.SEND);
        send.setUser(connected.getUser());
        send.setDestination("/user/queue/notifications");
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(message(send), null));
    }

    @Test
    void rawOtherUserAndBrokerSessionQueuesCannotBeSubscribedTo() {
        var auth = new UsernamePasswordAuthenticationToken(recipient.getEmail(), null, List.of());
        for (String destination : Arrays.asList("/queue/notifications", "/queue/messages",
                "/user/other@example.edu/queue/notifications", "/user/recipient@example.edu/queue/notifications",
                "/queue/notifications-useranother-session", "/user/queue/notifications/extra", null)) {
            var subscription = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
            subscription.setUser(auth);
            subscription.setDestination(destination);
            assertThrows(AccessDeniedException.class, () -> interceptor.preSend(message(subscription), null), destination);
        }
    }

    @Test
    void missingOrUnauthenticatedPrincipalCannotSubscribe() {
        var subscription = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        subscription.setDestination("/user/queue/notifications");
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(message(subscription), null));
        subscription.setUser(new UsernamePasswordAuthenticationToken("untrusted", "unused"));
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(message(subscription), null));
        subscription.setUser(new AnonymousAuthenticationToken("anonymous", "anonymousUser",
                List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ANONYMOUS"))));
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(message(subscription), null));
    }

    @Test
    void expiredInvalidMissingAndDeletedUserTokensFailConnect() {
        assertThrows(AccessDeniedException.class,
                () -> interceptor.preSend(message(connect("expired", System.currentTimeMillis() - 1000)), null));
        assertThrows(AccessDeniedException.class,
                () -> interceptor.preSend(message(connect(null, 0)), null));
        var invalid = connect("invalid", System.currentTimeMillis() + 60000);
        when(jwt.parseToken("invalid")).thenThrow(new JwtException("Invalid signature"));
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(message(invalid), null));
        var deleted = connect("deleted", System.currentTimeMillis() + 60000);
        when(users.findByEmail(recipient.getEmail())).thenReturn(Optional.empty());
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(message(deleted), null));
        verifyNoInteractions(sessions);
    }

    @Test
    void publisherTargetsOnlyPersistedRecipientAndIncludesDeduplicationId() {
        var messaging = mock(SimpMessagingTemplate.class);
        var publisher = new NotificationLivePublisher(users, messaging);
        when(users.findById(recipient.getId())).thenReturn(Optional.of(recipient));
        var notice = new NotificationResponse("a".repeat(64), PrivateNotification.Type.MODERATION_NOTICE,
                null, new ObjectId().toHexString(), new PrivateNotification.Payload("Listing removed.",
                PrivateNotification.Status.REMOVED, null), Instant.now(), null);
        publisher.publish(recipient.getId(), notice);
        verify(messaging).convertAndSendToUser(recipient.getEmail(), "/queue/notifications", notice);
        verifyNoMoreInteractions(messaging);
        assertEquals("a".repeat(64), notice.id());
        when(users.findById(recipient.getId())).thenReturn(Optional.empty());
        publisher.publish(recipient.getId(), notice);
        verifyNoMoreInteractions(messaging);
    }

    @Test
    void springUserDestinationRoutingExcludesOtherUsersSessions() {
        var registry = mock(SimpUserRegistry.class);
        var user = mock(SimpUser.class);
        var session = mock(SimpSession.class);
        when(registry.getUser(recipient.getEmail())).thenReturn(user);
        when(user.getSessions()).thenReturn(Set.of(session));
        when(session.getId()).thenReturn("recipient-session");
        var headers = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        headers.setDestination("/user/" + recipient.getEmail() + "/queue/notifications");
        var message = MessageBuilder.createMessage(new byte[0], headers.getMessageHeaders());
        var resolved = new DefaultUserDestinationResolver(registry).resolveDestination(message);
        assertNotNull(resolved);
        assertEquals(Set.of("/queue/notifications-userrecipient-session"), resolved.getTargetDestinations());
        verify(registry, never()).getUser("other@example.edu");
    }
}
