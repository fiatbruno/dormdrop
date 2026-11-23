package edu.augustana.csc305.project.security;

import edu.augustana.csc305.project.config.PublicUrls;
import edu.augustana.csc305.project.controller.AuthController;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.UserRepository;
import edu.augustana.csc305.project.service.AuthService;
import io.jsonwebtoken.Claims;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class SuspendedAuthenticationTest {
    private final UserRepository users = mock(UserRepository.class);
    private final PasswordEncoder passwords = mock(PasswordEncoder.class);
    private final JwtService jwt = mock(JwtService.class);
    private final User user = new User(new ObjectId(), "Member", "member@augustana.edu", "hash");
    private AuthController controller;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        user.setEmailVerified(true);
        when(users.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(passwords.matches("correct", "hash")).thenReturn(true);
        when(jwt.generateToken(user)).thenReturn("valid-token");
        controller = new AuthController(users, passwords, jwt, mock(AuthService.class), mock(PublicUrls.class));
        mvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void correctCredentialsReceiveRoundedUpSuspensionDaysAndNoToken() throws Exception {
        user.setSuspendedUntil(Instant.now().plusSeconds(86400 + 60));
        mvc.perform(post("/auth/login").contentType("application/json")
                        .content("{\"email\":\"member@augustana.edu\",\"password\":\"correct\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_SUSPENDED"))
                .andExpect(jsonPath("$.daysRemaining").value(2))
                .andExpect(jsonPath("$.token").doesNotExist());
        verify(jwt, never()).generateToken(any());
    }

    @Test
    void lessThanOneDayRemainingIsReportedAsOneDay() throws Exception {
        user.setSuspendedUntil(Instant.now().plusSeconds(60));
        mvc.perform(post("/auth/login").contentType("application/json")
                        .content("{\"email\":\"member@augustana.edu\",\"password\":\"correct\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.daysRemaining").value(1));
    }

    @Test
    void invalidPasswordDoesNotRevealSuspension() {
        user.setSuspendedUntil(Instant.now().plusSeconds(3600));
        assertThrows(BadCredentialsException.class,
                () -> controller.login(new LoginRequest(user.getEmail(), "wrong")));
    }

    @Test
    void expiredSuspensionAllowsLoginWithoutWaitingForCleanup() throws Exception {
        user.setSuspendedUntil(Instant.now().minusSeconds(1));
        mvc.perform(post("/auth/login").contentType("application/json")
                        .content("{\"email\":\"member@augustana.edu\",\"password\":\"correct\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("valid-token"));
    }

    @Test
    void existingTokensAreUnauthenticatedDuringSuspensionAndWorkAfterExpiry() throws Exception {
        var details = new PersistedUserDetailsService(users);
        var filter = new JwtAuthenticationFilter(jwt, details);
        Claims claims = mock(Claims.class);
        when(jwt.parseToken("token")).thenReturn(claims);
        when(claims.getSubject()).thenReturn(user.getEmail());
        user.setSuspendedUntil(Instant.now().plusSeconds(60));
        assertThrows(LockedException.class, () -> details.loadUserByUsername(user.getEmail()));
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer token");
        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());
        assertNull(SecurityContextHolder.getContext().getAuthentication());

        user.setSuspendedUntil(Instant.now().minusSeconds(1));
        MockHttpServletRequest retry = new MockHttpServletRequest();
        retry.addHeader("Authorization", "Bearer token");
        filter.doFilter(retry, new MockHttpServletResponse(), new MockFilterChain());
        assertEquals(user.getEmail(), SecurityContextHolder.getContext().getAuthentication().getName());
    }

    @Test
    void activeWebSocketIsClosedWhenUserIsSuspended() throws Exception {
        WebSocketSessions sessions = new WebSocketSessions(users);
        try {
            WebSocketHandler handler = sessions.decorate(mock(WebSocketHandler.class));
            WebSocketSession socket = mock(WebSocketSession.class);
            when(socket.getId()).thenReturn("socket-1");
            when(users.findById(user.getId())).thenReturn(Optional.of(user));
            handler.afterConnectionEstablished(socket);
            sessions.registerUser("socket-1", user.getId(), user.getRoleVersion());
            user.setSuspendedUntil(Instant.now().plusSeconds(60));
            sessions.checkRoles();
            verify(socket).close(CloseStatus.POLICY_VIOLATION);
        } finally {
            sessions.stop();
        }
    }
}
