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

class OfferDecisionTest {
    private final MongoTemplate mongo = mock(MongoTemplate.class);
    private final UserRepository users = mock(UserRepository.class);
    private final TransactionOperations transactions = mock(TransactionOperations.class);
    private final User buyer = user("buyer");
    private final User seller = user("seller");
    private final User stranger = user("stranger");
    private final Listing listing = new Listing();
    private final OfferNegotiation offer;
    private final OfferService service;

    OfferDecisionTest() {
        listing.setId(new ObjectId());
        listing.setOwnerId(seller.getId());
        listing.setVersion(3L);
        offer = OfferNegotiation.create(listing.getId(), buyer.getId(), seller.getId(),
                new BigDecimal("20.00"), Instant.now());
        for (User user : List.of(buyer, seller, stranger)) when(users.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
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

    @Test void acceptsOnlyTheOtherParticipantAndPreservesListingStatus() {
        var result = service.decide(auth(seller), id(), "ACCEPT", 0L, "accept-1");
        assertEquals(OfferNegotiation.Status.ACCEPTED, result.status());
        assertEquals(1, result.version());
        assertEquals(OfferNegotiation.Action.ACCEPTED, result.history().get(1).action());
        assertEquals(seller.getId(), result.history().get(1).actorId());
        assertEquals(ListingStatus.AVAILABLE, listing.getStatus());
        verify(mongo).insert(argThat((OfferDecisionRequest record) -> record.result().equals(result)));
        verify(mongo).updateFirst(any(Query.class), any(Update.class), eq(Listing.class));
        assertStatus(403, () -> service.decide(auth(buyer), id(), "ACCEPT", 0L, "buyer"));
        assertStatus(403, () -> service.decide(auth(stranger), id(), "ACCEPT", 0L, "stranger"));
    }

    @Test void buyerMayRespondToSellerCounterAndRejectionDoesNotRequireListing() {
        var counter = offer.counter(seller.getId(), new BigDecimal("25.00"), 0L, Instant.now());
        when(mongo.findById(offer.id(), OfferNegotiation.class)).thenReturn(counter);
        when(mongo.findById(listing.getId(), Listing.class)).thenReturn(null);
        var result = service.decide(auth(buyer), id(), "REJECT", 1L, "reject");
        assertEquals(OfferNegotiation.Status.REJECTED, result.status());
        assertEquals(buyer.getId(), result.history().get(2).actorId());
        verify(mongo, never()).updateFirst(any(Query.class), any(Update.class), eq(Listing.class));
    }

    @Test void rejectsStaleUnavailableAndConflictingReplays() {
        assertStatus(409, () -> service.decide(auth(seller), id(), "ACCEPT", 1L, "stale"));
        listing.setStatus(ListingStatus.SOLD);
        assertStatus(409, () -> service.decide(auth(seller), id(), "ACCEPT", 0L, "sold"));
        listing.setStatus(ListingStatus.AVAILABLE);
        listing.setModerationVisibility(ModerationTypes.Visibility.HIDDEN);
        assertStatus(409, () -> service.decide(auth(seller), id(), "ACCEPT", 0L, "hidden"));
        var result = offer.decide(seller.getId(), OfferNegotiation.Status.REJECTED, 0L, Instant.now());
        String requestId = seller.getId().toHexString() + ":decide-offer:used";
        when(mongo.findById(requestId, OfferDecisionRequest.class)).thenReturn(new OfferDecisionRequest(
                requestId, offer.id(), OfferNegotiation.Status.REJECTED, 0L, result, Instant.now()));
        assertEquals(result, service.decide(auth(seller), id(), "REJECT", 0L, "used"));
        assertStatus(409, () -> service.decide(auth(seller), id(), "ACCEPT", 0L, "used"));
        verify(mongo, never()).insert(any(OfferDecisionRequest.class));
    }

    @Test void validatesHttpDecisionAndReturnsTheUpdatedOffer() throws Exception {
        var mvc = MockMvcBuilders.standaloneSetup(new OfferController(service)).build();
        String path = "/offers/" + id() + "/decisions";
        mvc.perform(post(path).principal(auth(seller)).header("Idempotency-Key", "http")
                .contentType("application/json").content("{\"action\":\"ACCEPT\",\"expectedVersion\":0}"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.history[1].action").value("ACCEPTED"));
        mvc.perform(post(path).principal(auth(seller)).header("Idempotency-Key", "http")
                .contentType("application/json").content("{\"action\":\"INVALID\",\"expectedVersion\":0}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post(path).principal(auth(seller)).contentType("application/json")
                .content("{\"action\":\"ACCEPT\",\"expectedVersion\":0}"))
                .andExpect(status().isBadRequest());
    }
}
