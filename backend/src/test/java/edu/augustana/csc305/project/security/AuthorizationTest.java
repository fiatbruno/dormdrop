package edu.augustana.csc305.project.security;

import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.model.UserRole;
import edu.augustana.csc305.project.repository.UserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.access.AccessDeniedException;

import java.util.Date;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuthorizationTest {
    private final UserRepository repository = mock(UserRepository.class);
    private final PersistedUserDetailsService users = new PersistedUserDetailsService(repository);
    private final JwtService jwt = mock(JwtService.class);
    private final User user = new User(null, "Student", "student@augustana.edu", "hash");

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void defaultsAndLegacyNullRolesAreStudents() {
        assertEquals(UserRole.STUDENT, new User().getRole());
        assertEquals(UserRole.STUDENT, user.getRole());
        user.setRole(null);
        assertEquals(UserRole.STUDENT, user.getRole());
    }

    private Claims claims(String subject) {
        return io.jsonwebtoken.Jwts.claims()
                .subject(subject)
                .expiration(new Date(System.currentTimeMillis() + 60000))
                .build();
    }

    private void request(String token) throws Exception {
        var request = new MockHttpServletRequest();
        if (token != null) request.addHeader("Authorization", "Bearer " + token);
        new JwtAuthenticationFilter(jwt, users).doFilter(request, new MockHttpServletResponse(),
                (req, res) -> {});
    }

    @Test
    void httpResolvesCurrentRoleForTheSameToken() throws Exception {
        when(jwt.parseToken("token")).thenReturn(claims(user.getEmail()));
        when(repository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        request("token");
        assertEquals("[ROLE_STUDENT]", SecurityContextHolder.getContext().getAuthentication().getAuthorities().toString());
        user.setRole(UserRole.ADMIN);
        request("token");
        var auth = SecurityContextHolder.getContext().getAuthentication();
        assertEquals(user.getEmail(), auth.getPrincipal());
        assertEquals("[ROLE_ADMIN]", auth.getAuthorities().toString());
        verify(repository, times(2)).findByEmail(user.getEmail());
    }

    @Test
    void invalidMissingDeletedAndBlankSubjectsCannotAuthenticate() throws Exception {
        request(null);
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        when(jwt.parseToken("bad")).thenThrow(new JwtException("invalid or expired"));
        request("bad");
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        when(jwt.parseToken("deleted")).thenReturn(claims("deleted@augustana.edu"));
        request("deleted");
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        when(jwt.parseToken("blank")).thenReturn(claims(" "));
        request("blank");
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        assertThrows(UsernameNotFoundException.class, () -> users.loadUserByUsername(null));
    }

    private org.springframework.messaging.Message<byte[]> message(StompHeaderAccessor accessor) {
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    @Test
    void webSocketLoadsRolesAndKeepsDestinationRestrictions() {
        var sessions = mock(WebSocketSessions.class);
        var interceptor = new WebSocketAuthInterceptor(jwt, sessions, users);
        user.setRole(UserRole.ADMIN);
        when(repository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(jwt.parseToken("token")).thenReturn(claims(user.getEmail()));
        var connect = StompHeaderAccessor.create(StompCommand.CONNECT);
        connect.setSessionId("session");
        connect.setNativeHeader("Authorization", "Bearer token");
        interceptor.preSend(message(connect), mock(org.springframework.messaging.MessageChannel.class));
        var auth = (org.springframework.security.core.Authentication) connect.getUser();
        assertEquals("[ROLE_ADMIN]", auth.getAuthorities().toString());
        var subscribe = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        subscribe.setUser(auth);
        subscribe.setDestination("/user/queue/messages");
        assertDoesNotThrow(() -> interceptor.preSend(message(subscribe), null));
        subscribe.setDestination("/queue/messages");
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(message(subscribe), null));
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(message(StompHeaderAccessor.create(StompCommand.SEND)), null));
        when(repository.findByEmail(user.getEmail())).thenReturn(Optional.empty());
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(message(connect), null));
    }

    @Test
    void seederAssignsAdminAndLeavesExistingUsersAlone() throws Exception {
        var encoder = mock(PasswordEncoder.class);
        when(encoder.encode("password")).thenReturn("hash");
        var seeder = new AdminSeeder(repository, encoder, "Admin", "admin@example.com", "password");
        seeder.run(null);
        verify(repository).storeUser(argThat(value -> value.getRole() == UserRole.ADMIN));
        clearInvocations(repository);
        when(repository.count()).thenReturn(1L);
        seeder.run(null);
        verify(repository, never()).storeUser(any());
    }
}
