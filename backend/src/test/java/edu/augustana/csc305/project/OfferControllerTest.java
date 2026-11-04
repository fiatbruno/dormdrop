package edu.augustana.csc305.project;

import edu.augustana.csc305.project.controller.OfferController;
import edu.augustana.csc305.project.model.OfferNegotiation;
import edu.augustana.csc305.project.service.OfferService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class OfferControllerTest {
    private final OfferService service = mock(OfferService.class);
    private final UsernamePasswordAuthenticationToken auth =
            new UsernamePasswordAuthenticationToken("buyer@augustana.edu", null, List.of());
    private final OfferNegotiation offer = OfferNegotiation.create(new ObjectId(), new ObjectId(),
            new ObjectId(), new BigDecimal("19.99"), Instant.parse("2026-11-03T12:00:00Z"));

    @Test void submissionUsesAuthenticatedIdentityAndReturnsSafe201And200Responses() throws Exception {
        var mvc = MockMvcBuilders.standaloneSetup(new OfferController(service)).build();
        when(service.submit(eq(auth), eq(offer.listingId().toHexString()), eq(new BigDecimal("19.99")), eq("request-key")))
                .thenReturn(new OfferService.Submission(offer, true), new OfferService.Submission(offer, false));
        String path = "/home/" + offer.listingId().toHexString() + "/offers";
        for (int expected : List.of(201, 200)) {
            var response = mvc.perform(post(path).principal(auth).header("Idempotency-Key", "request-key")
                            .contentType("application/json").content("{\"amount\":19.99,\"buyerId\":\"attacker\",\"sellerId\":\"attacker\"}"))
                    .andExpect(status().is(expected)).andExpect(header().string("Cache-Control", "no-store"))
                    .andReturn().getResponse().getContentAsString();
            assertTrue(response.contains("\"amount\":19.99"));
            assertTrue(response.contains(offer.id().toHexString()));
            assertFalse(response.contains("password"));
            assertFalse(response.contains("email"));
            assertFalse(response.contains("token"));
        }
        verify(service, times(2)).submit(auth, offer.listingId().toHexString(), new BigDecimal("19.99"), "request-key");
        mvc.perform(post(path).principal(auth).contentType("application/json").content("{\"amount\":19.99}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post(path).principal(auth).header("Idempotency-Key", "request-key")
                        .contentType("application/json").content("{\"amount\":{} }"))
                .andExpect(status().isBadRequest());
    }

    @Test void readAndListReturnOnlyOfferDtoAndDelegatePerspective() throws Exception {
        var mvc = MockMvcBuilders.standaloneSetup(new OfferController(service)).build();
        when(service.get(auth, offer.id().toHexString())).thenReturn(offer);
        when(service.list(auth, "buyer", 0, 20)).thenReturn(new OfferService.Page(List.of(offer), 1, 0, 20, 1));
        mvc.perform(get("/offers/" + offer.id().toHexString()).principal(auth))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(offer.id().toHexString()))
                .andExpect(jsonPath("$.history[0].action").value("PROPOSED"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
        mvc.perform(get("/me/offers").principal(auth).param("perspective", "buyer"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(offer.id().toHexString()))
                .andExpect(jsonPath("$.total").value(1));
        verify(service).list(auth, "buyer", 0, 20);
    }
}
