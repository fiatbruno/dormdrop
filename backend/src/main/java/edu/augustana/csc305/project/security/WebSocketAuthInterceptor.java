package edu.augustana.csc305.project.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import org.springframework.security.core.AuthenticationException;

@Component
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    private final JwtService jwtService;
    private final WebSocketSessions sessions;

    private final PersistedUserDetailsService users;

    public WebSocketAuthInterceptor(JwtService jwtService, WebSocketSessions sessions,
                                    PersistedUserDetailsService users) {
        this.jwtService = jwtService;
        this.sessions = sessions;
        this.users = users;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(
                        message, StompHeaderAccessor.class
                );

        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }

        StompCommand command = accessor.getCommand();

        if (command == StompCommand.CONNECT) {
            String header =
                    accessor.getFirstNativeHeader("Authorization");

            if (header == null || !header.startsWith("Bearer ")) {
                throw new AccessDeniedException("Login required.");
            }

            try {
                Claims claims = jwtService.parseToken(header.substring(7));
                String email = claims.getSubject();

                if (email == null || email.isBlank()) {
                    throw new AccessDeniedException("Invalid token.");
                }

                if (claims.getExpiration() == null || claims.getExpiration().getTime() <= System.currentTimeMillis()) {
                    throw new AccessDeniedException("Expired token.");
                }
                var user = users.loadUserByUsername(email);
                sessions.expireAt(accessor.getSessionId(), claims.getExpiration().getTime());
                accessor.setUser(
                        new UsernamePasswordAuthenticationToken(
                                user.getUsername(), null, user.getAuthorities()
                        )
                );
            } catch (JwtException | IllegalArgumentException | AuthenticationException ex) {
                throw new AccessDeniedException(
                        "Invalid or expired token.", ex
                );
            }
        } else if (command == StompCommand.SUBSCRIBE) {
            if (accessor.getUser() == null ||
                    !"/user/queue/messages".equals(
                            accessor.getDestination()
                    )) {
                throw new AccessDeniedException(
                        "You cannot subscribe to this destination."
                );
            }
        } else if (command == StompCommand.SEND) {
            // Messages must go through the existing REST endpoint.
            throw new AccessDeniedException(
                    "Send messages through the REST API."
            );
        }

        return message;
    }
}