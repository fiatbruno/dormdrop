package edu.augustana.csc305.project.service;

import com.mongodb.client.result.UpdateResult;
import edu.augustana.csc305.project.model.CompletedTransaction;
import edu.augustana.csc305.project.model.Conversation;
import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.model.ListingStatus;
import edu.augustana.csc305.project.model.OfferNegotiation;
import edu.augustana.csc305.project.model.PickupProposal;
import edu.augustana.csc305.project.model.PickupStatus;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.UserRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TransactionCompletionServiceTest {
    private final MongoTemplate mongo = mock(MongoTemplate.class);
    private final UserRepository users = mock(UserRepository.class);
    private final TransactionCompletionService service = new TransactionCompletionService(
            mongo, users, TransactionOperations.withoutTransaction());
    private final User buyer = new User(new ObjectId(), "Buyer", "buyer@example.com", "test");
    private final User seller = new User(new ObjectId(), "Seller", "seller@example.com", "test");
    private final Authentication buyerAuth = signIn(buyer);
    private final Authentication sellerAuth = signIn(seller);
    private final ObjectId listingId = new ObjectId();
    private final ObjectId conversationId = new ObjectId();
    private final Instant now = Instant.now();
    private final LocalDateTime campusNow = LocalDateTime.ofInstant(now, ZoneId.of("America/Chicago"));
    private final OfferNegotiation offer = OfferNegotiation.create(
            listingId, buyer.getId(), seller.getId(), BigDecimal.TEN, now)
            .decide(seller.getId(), OfferNegotiation.Status.ACCEPTED, 0, now);
    private final String offerId = offer.id().toHexString();

    @BeforeEach
    void setUp() {
        Listing listing = new Listing();
        listing.setId(listingId);
        listing.setOwnerId(seller.getId());
        listing.setStatus(ListingStatus.RESERVED);
        listing.setReservedOfferId(offer.id());
        Conversation conversation = new Conversation(listingId, buyer.getId(), seller.getId());
        conversation.setId(conversationId);

        when(users.findByEmail(buyer.getEmail())).thenReturn(Optional.of(buyer));
        when(users.findByEmail(seller.getEmail())).thenReturn(Optional.of(seller));
        when(mongo.findById(offer.id(), OfferNegotiation.class)).thenReturn(offer);
        when(mongo.findById(listingId, Listing.class)).thenReturn(listing);
        when(mongo.findOne(any(Query.class), eq(Conversation.class))).thenReturn(conversation);
    }

    @Test
    void waitingForTheSellerOrForThePickupTimeKeepsReceiptDisabled() {
        PickupProposal proposal = pickup(buyer, campusNow.minusHours(2));
        assertFalse(service.getReceiptStatus(offerId, buyerAuth).canConfirm());
        assertRejected(HttpStatus.CONFLICT, buyerAuth);

        proposal.setStatus(PickupStatus.ACCEPTED);
        proposal.setTimePickUp(campusNow.plusHours(2));
        var status = service.getReceiptStatus(offerId, buyerAuth);
        assertFalse(status.canConfirm());
        assertTrue(status.waitingForPickupTime());
        assertRejected(HttpStatus.CONFLICT, buyerAuth);
    }

    @Test
    void aPickupProposedByTheSellerAndAcceptedByTheBuyerDoesNotUnlockReceipt() {
        pickup(seller, campusNow.minusHours(2)).setStatus(PickupStatus.ACCEPTED);
        assertFalse(service.getReceiptStatus(offerId, buyerAuth).canConfirm());
        assertRejected(HttpStatus.CONFLICT, buyerAuth);
    }

    @Test
    void anElapsedPickupEnablesTheBuyerWithoutRecordingReceiptUntilConfirmation() {
        PickupProposal proposal = pickup(buyer, campusNow.minusHours(2));
        proposal.setStatus(PickupStatus.ACCEPTED);

        var sellerStatus = service.getReceiptStatus(offerId, sellerAuth);
        assertFalse(sellerStatus.canConfirm());
        assertNull(sellerStatus.transaction());
        assertRejected(HttpStatus.FORBIDDEN, sellerAuth);

        var buyerStatus = service.getReceiptStatus(offerId, buyerAuth);
        assertTrue(buyerStatus.canConfirm());
        assertNull(buyerStatus.transaction());
        verify(mongo, never()).insert(any(CompletedTransaction.class));
        verify(mongo, never()).updateFirst(any(Query.class), any(Update.class), eq(Listing.class));

        when(mongo.updateFirst(any(Query.class), any(Update.class), eq(Listing.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));
        when(mongo.insert(any(CompletedTransaction.class))).thenAnswer(call -> call.getArgument(0));

        CompletedTransaction completed = service.confirmReceipt(offerId, buyerAuth);
        assertEquals(buyer.getId(), completed.getBuyerId());
        assertEquals(proposal.getId(), completed.getPickupProposalId());
    }

    private PickupProposal pickup(User proposer, LocalDateTime time) {
        PickupProposal pickup = new PickupProposal(conversationId, proposer.getId(), "Library", time, "");
        pickup.setId(new ObjectId());
        when(mongo.findOne(any(Query.class), eq(PickupProposal.class))).thenReturn(pickup);
        return pickup;
    }

    private void assertRejected(HttpStatus expected, Authentication auth) {
        var error = assertThrows(ResponseStatusException.class, () -> service.confirmReceipt(offerId, auth));
        assertEquals(expected, error.getStatusCode());
    }

    private static Authentication signIn(User user) {
        return UsernamePasswordAuthenticationToken.authenticated(user.getEmail(), null, List.of());
    }
}
