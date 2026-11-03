package edu.augustana.csc305.project;

import edu.augustana.csc305.project.model.OfferNegotiation;
import edu.augustana.csc305.project.model.OfferNegotiation.*;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import static org.junit.jupiter.api.Assertions.*;

class OfferNegotiationTest {
    private final ObjectId buyer = new ObjectId(), seller = new ObjectId(), listing = new ObjectId();
    private final Instant time = Instant.parse("2026-10-21T13:14:15Z");
    private OfferNegotiation create() { return OfferNegotiation.create(listing, buyer, seller, new BigDecimal("20.00"), time); }

    @Test void counterAndDecisionAppendHistoryWithoutMutatingEarlierSnapshots() {
        var initial = create();
        var counter = initial.counter(seller, new BigDecimal("25.00"), 0, time.plusSeconds(1));
        var reply = counter.counter(buyer, new BigDecimal("22.00"), 1, time.plusSeconds(2));
        var accepted = reply.decide(seller, Status.ACCEPTED, 2, time.plusSeconds(3));
        assertEquals(Status.ACCEPTED, accepted.status());
        assertEquals(new BigDecimal("22.00"), accepted.amount());
        assertEquals(3, accepted.version());
        assertEquals(4, accepted.history().size());
        assertEquals(Action.PROPOSED, accepted.history().get(0).action());
        assertEquals(Action.ACCEPTED, accepted.history().get(3).action());
        assertEquals(1, initial.history().size());
        assertEquals(Status.PENDING, initial.status());
        assertThrows(UnsupportedOperationException.class, () -> accepted.history().clear());
        var copied = new ArrayList<>(initial.history());
        var snapshot = new OfferNegotiation(initial.id(), listing, buyer, seller, buyer, initial.amount(),
                initial.status(), initial.version(), time, time, copied);
        copied.clear();
        assertEquals(1, snapshot.history().size());
    }

    @Test void rejectsStaleSelfNonParticipantAndTerminalResponses() {
        var initial = create();
        assertThrows(IllegalStateException.class, () -> initial.counter(seller, BigDecimal.ONE, 1, time));
        assertThrows(IllegalArgumentException.class, () -> initial.counter(buyer, BigDecimal.ONE, 0, time));
        assertThrows(IllegalArgumentException.class, () -> initial.decide(new ObjectId(), Status.ACCEPTED, 0, time));
        assertThrows(IllegalArgumentException.class, () -> initial.decide(seller, Status.PENDING, 0, time));
        var rejected = initial.decide(seller, Status.REJECTED, 0, time);
        assertThrows(IllegalStateException.class, () -> rejected.counter(buyer, BigDecimal.ONE, 1, time));
        assertEquals(1, initial.history().size());
    }

    @Test void validatesPricesAndParticipants() {
        for (String bad : new String[]{"0", "-1", "0.001"})
            assertThrows(IllegalArgumentException.class, () -> OfferNegotiation.create(listing, buyer, seller, new BigDecimal(bad), time));
        assertThrows(IllegalArgumentException.class, () -> OfferNegotiation.create(listing, buyer, buyer, BigDecimal.ONE, time));
        assertDoesNotThrow(() -> OfferNegotiation.create(listing, buyer, seller, new BigDecimal("0.01"), time));
        assertDoesNotThrow(() -> OfferNegotiation.create(listing, buyer, seller, new BigDecimal("19.99"), time));
    }
}
