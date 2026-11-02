package edu.augustana.csc305.project;

import edu.augustana.csc305.project.config.ApiPrefixConfig;
import edu.augustana.csc305.project.controller.PrivateNotificationController;
import edu.augustana.csc305.project.dto.NotificationResponse;
import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.UserRepository;
import edu.augustana.csc305.project.security.*;
import edu.augustana.csc305.project.service.PrivateNotificationService;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringJUnitConfig(PrivateNotificationApiTest.Config.class)
@WebAppConfiguration
@TestPropertySource(properties = {"api.prefix=/api/v1", "app.jwt.expiration=60000", "app.jwt.secret=test-only-unused-secret"})
class PrivateNotificationApiTest {
    @Configuration
    @EnableWebMvc
    @EnableWebSecurity
    @Import({SecurityConfig.class, ApiPrefixConfig.class, PrivateNotificationController.class})
    static class Config {
        @Bean PrivateNotificationService notifications() { return mock(PrivateNotificationService.class); }
        @Bean UserRepository users() { return mock(UserRepository.class); }
        @Bean JwtService jwt() { return mock(JwtService.class); }
        @Bean PersistedUserDetailsService details(UserRepository users) { return new PersistedUserDetailsService(users); }
    }

    @Autowired WebApplicationContext context;
    @Autowired PrivateNotificationService service;
    @Autowired UserRepository users;
    @Autowired JwtService jwt;
    MockMvc mvc;

    @BeforeEach
    void setup() {
        reset(service, users, jwt);
        mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(context.getBean(FilterChainProxy.class)).build();
        var user = new User(new ObjectId(), "Recipient", "recipient@example.edu", "hash");
        when(users.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(jwt.parseToken("test-token")).thenReturn(io.jsonwebtoken.Jwts.claims().subject(user.getEmail())
                .expiration(new Date(System.currentTimeMillis() + 60000)).build());
    }

    @Test
    void missingAuthReturns401OnEveryRoute() throws Exception {
        mvc.perform(get("/api/v1/me/notifications")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/me/notifications/unread-count")).andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/v1/me/notifications/" + "a".repeat(64) + "/read")).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @Test
    void defaultPaginationAndCountUseAuthenticatedRecipientAndNoStore() throws Exception {
        when(service.list(any(), eq(0), eq(20))).thenReturn(new NotificationResponse.Page(List.of(), 0, 0, 0, 20));
        when(service.unreadCount(any())).thenReturn(new NotificationResponse.UnreadCount(0));
        mvc.perform(get("/api/v1/me/notifications").header("Authorization", "Bearer test-token"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.size").value(20));
        mvc.perform(get("/api/v1/me/notifications/unread-count").header("Authorization", "Bearer test-token"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.count").value(0));
        verify(service).list(argThat(auth -> auth.getName().equals("recipient@example.edu")), eq(0), eq(20));
    }

    @Test
    void crossRecipientReadIs404AndInternalFieldsAreAbsentFromSafeResponse() throws Exception {
        String id = "b".repeat(64);
        when(service.read(any(), eq(id))).thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND));
        mvc.perform(patch("/api/v1/me/notifications/" + id + "/read").header("Authorization", "Bearer test-token"))
                .andExpect(status().isNotFound());
        var notice = new NotificationResponse(id, PrivateNotification.Type.MODERATION_NOTICE, null, new ObjectId().toHexString(),
                new PrivateNotification.Payload("Your listing was removed.", PrivateNotification.Status.REMOVED, null), Instant.now(), null);
        when(service.list(any(), eq(0), eq(20))).thenReturn(new NotificationResponse.Page(List.of(notice), 1, 1, 0, 20));
        mvc.perform(get("/api/v1/me/notifications").header("Authorization", "Bearer test-token"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].payload.message").value("Your listing was removed."))
                .andExpect(jsonPath("$.items[0].recipientId").doesNotExist())
                .andExpect(jsonPath("$.items[0].sourceEventKey").doesNotExist())
                .andExpect(jsonPath("$.items[0].internalRationale").doesNotExist());
    }

    @Test
    void payloadAndEventRejectInvalidContracts() {
        assertThrows(IllegalArgumentException.class, () -> new PrivateNotification.Payload("", PrivateNotification.Status.ACCEPTED, null));
        assertThrows(IllegalArgumentException.class, () -> new PrivateNotification.Payload("Offer", PrivateNotification.Status.ACCEPTED, new BigDecimal("-1")));
        var payload = new PrivateNotification.Payload("Offer", PrivateNotification.Status.REJECTED, new BigDecimal("20.00"));
        assertThrows(IllegalArgumentException.class, () -> new NotificationOutboxEvent(new ObjectId(), "key", new ObjectId(),
                PrivateNotification.Type.OFFER_ACCEPTED, new ObjectId(), null, payload, Instant.now(), "PENDING"));
    }
}
