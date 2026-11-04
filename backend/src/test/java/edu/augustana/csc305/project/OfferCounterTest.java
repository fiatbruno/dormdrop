package edu.augustana.csc305.project;

import com.mongodb.client.result.UpdateResult;
import edu.augustana.csc305.project.controller.OfferController;
import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.UserRepository;
import edu.augustana.csc305.project.service.OfferService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class OfferCounterTest {
    private final MongoTemplate mongo = mock(MongoTemplate.class);
    private final UserRepository users = mock(UserRepository.class);
    private final TransactionOperations transactions = mock(TransactionOperations.class);
    private final User buyer = user("buyer");
    private final User seller = user("seller");
    private final User outsider = user("outsider");
    private final Listing listing = new Listing();
    private final OfferNegotiation offer;
    private final OfferService service;

    OfferCounterTest() {
        listing.setId(new ObjectId());
        listing.setOwnerId(seller.getId());
        listing.setVersion(3L);
        listing.setListingType("For sale");
        listing.setPrice(new BigDecimal("50.00"));
        offer = OfferNegotiation.create(listing.getId(), buyer.getId(), seller.getId(),
                new BigDecimal("20.00"), Instant.parse("2026-11-03T12:00:00Z"));
        for (User user : List.of(buyer, seller, outsider)) when(users.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(mongo.findById(offer.id(), OfferNegotiation.class)).thenReturn(offer);
        when(mongo.findById(listing.getId(), Listing.class)).thenReturn(listing);
        when(mongo.updateFirst(any(Query.class), any(Update.class), eq(Listing.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));
        when(mongo.updateFirst(any(Query.class), any(Update.class), eq(OfferNegotiation.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));
        when(transactions.execute(any())).thenAnswer(call ->
                ((TransactionCallback<?>) call.getArgument(0)).doInTransaction(mock(TransactionStatus.class)));
        service = new OfferService(mongo, users, transactions);
    }

    private static User user(String name) {
        User user = new User(new ObjectId(), name, name + "@augustana.edu", "hash");
        user.setEmailVerified(true);
        return user;
    }
    private static UsernamePasswordAuthenticationToken auth(User user) {
        return new UsernamePasswordAuthenticationToken(user.getEmail(), null, List.of());
    }
    private String id() { return offer.id().toHexString(); }
    private static void assertStatus(int code, org.junit.jupiter.api.function.Executable work) {
        assertEquals(code, assertThrows(ResponseStatusException.class, work).getStatusCode().value());
    }

    @Test void repeatedCountersAndAcceptanceKeepAllPricesAndParticipants() {
        var sellerCounter = service.counter(auth(seller), id(), new BigDecimal("25.00"), 0L, "seller");
        assertEquals(seller.getId(), sellerCounter.currentProposerId());
        assertEquals(1, sellerCounter.version());
        when(mongo.findById(offer.id(), OfferNegotiation.class)).thenReturn(sellerCounter);
        var buyerCounter = service.counter(auth(buyer), id(), new BigDecimal("22.00"), 1L, "buyer");
        assertEquals(buyer.getId(), buyerCounter.currentProposerId());
        when(mongo.findById(offer.id(), OfferNegotiation.class)).thenReturn(buyerCounter);
        var accepted = service.decide(auth(seller), id(), "ACCEPT", 2L, "accept");
        assertEquals(OfferNegotiation.Status.ACCEPTED, accepted.status());
        assertEquals(new BigDecimal("22.00"), accepted.amount());
        assertEquals(List.of(new BigDecimal("20.00"), new BigDecimal("25.00"),
                new BigDecimal("22.00"), new BigDecimal("22.00")),
                accepted.history().stream().map(OfferNegotiation.HistoryEntry::amount).toList());
        assertEquals(List.of(buyer.getId(), seller.getId(), buyer.getId(), seller.getId()),
                accepted.history().stream().map(OfferNegotiation.HistoryEntry::actorId).toList());
        assertEquals(ListingStatus.AVAILABLE, listing.getStatus());
    }

    @Test void rejectsInvalidUnauthorizedStaleAndUnavailableRequests() {
        assertStatus(401, () -> service.counter(null, id(), BigDecimal.ONE, 0L, "key"));
        assertStatus(403, () -> service.counter(auth(buyer), id(), BigDecimal.ONE, 0L, "self"));
        assertStatus(403, () -> service.counter(auth(outsider), id(), BigDecimal.ONE, 0L, "outsider"));
        assertStatus(400, () -> service.counter(auth(seller), id(), BigDecimal.ZERO, 0L, "zero"));
        assertStatus(400, () -> service.counter(auth(seller), id(), new BigDecimal("1.001"), 0L, "fraction"));
        assertStatus(400, () -> service.counter(auth(seller), id(), BigDecimal.ONE, null, "version"));
        assertStatus(400, () -> service.counter(auth(seller), id(), BigDecimal.ONE, 0L, "bad key"));
        assertStatus(409, () -> service.counter(auth(seller), id(), BigDecimal.ONE, 1L, "stale"));
        listing.setStatus(ListingStatus.SOLD);
        assertStatus(409, () -> service.counter(auth(seller), id(), BigDecimal.ONE, 0L, "sold"));
        listing.setStatus(ListingStatus.AVAILABLE);
        listing.setListingType("Free");
        assertStatus(409, () -> service.counter(auth(seller), id(), BigDecimal.ONE, 0L, "free"));
        listing.setListingType("For sale");
        listing.setModerationVisibility(ModerationTypes.Visibility.REMOVED);
        assertStatus(409, () -> service.counter(auth(seller), id(), BigDecimal.ONE, 0L, "removed"));
        when(mongo.findById(listing.getId(), Listing.class)).thenReturn(null);
        assertStatus(409, () -> service.counter(auth(seller), id(), BigDecimal.ONE, 0L, "deleted"));
        verify(mongo, never()).insert(any(OfferCounterRequest.class));
    }

    @Test void retryReturnsOriginalResultAndRejectsKeyReuseWithDifferentDetails() {
        var result = offer.counter(seller.getId(), new BigDecimal("25.00"), 0L, Instant.now());
        String requestId = seller.getId().toHexString() + ":counter-offer:used";
        when(mongo.findById(requestId, OfferCounterRequest.class)).thenReturn(new OfferCounterRequest(
                requestId, offer.id(), new BigDecimal("25.00"), 0L, result, Instant.now()));
        assertEquals(result, service.counter(auth(seller), id(), new BigDecimal("25.0"), 0L, "used"));
        assertStatus(409, () -> service.counter(auth(seller), id(), new BigDecimal("26.00"), 0L, "used"));
        assertStatus(409, () -> service.counter(auth(seller), id(), new BigDecimal("25.00"), 1L, "used"));
        assertStatus(409, () -> service.counter(auth(seller), new ObjectId().toHexString(), new BigDecimal("25.00"), 0L, "used"));
        verify(mongo, never()).updateFirst(any(Query.class), any(Update.class), eq(OfferNegotiation.class));
    }

    @Test void terminalAndConcurrentChangesReturnConflict() {
        var rejected = offer.decide(seller.getId(), OfferNegotiation.Status.REJECTED, 0L, Instant.now());
        when(mongo.findById(offer.id(), OfferNegotiation.class)).thenReturn(rejected);
        assertStatus(409, () -> service.counter(auth(seller), id(), BigDecimal.TEN, 1L, "ended"));
        var counter = offer.counter(seller.getId(), BigDecimal.TEN, 0L, Instant.now());
        when(mongo.findById(offer.id(), OfferNegotiation.class)).thenReturn(counter);
        // After a competing counter wins, the old accept is stale even though the seller is now proposer.
        assertStatus(409, () -> service.decide(auth(seller), id(), "ACCEPT", 0L, "old-accept"));
    }

    @Test void httpRequiresKeyAndReturnsUpdatedCounter() throws Exception {
        var mvc = MockMvcBuilders.standaloneSetup(new OfferController(service)).build();
        String path = "/offers/" + id() + "/counteroffers";
        mvc.perform(post(path).principal(auth(seller)).header("Idempotency-Key", "http")
                .contentType("application/json").content("{\"amount\":25.00,\"expectedVersion\":0}"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.amount").value(25.00))
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.history[1].action").value("COUNTERED"));
        mvc.perform(post(path).principal(auth(seller)).contentType("application/json")
                .content("{\"amount\":25.00,\"expectedVersion\":0}"))
                .andExpect(status().isBadRequest());
    }
}
