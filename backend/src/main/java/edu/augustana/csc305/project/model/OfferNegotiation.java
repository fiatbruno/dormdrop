package edu.augustana.csc305.project.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.bson.types.Decimal128;
import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

/** Immutable negotiation snapshot. Persistent changes must also compare the stored version. */
@Document("offerNegotiations")
public record OfferNegotiation(
        @Id ObjectId id, ObjectId listingId, ObjectId buyerId, ObjectId sellerId,
        ObjectId currentProposerId, @Field(targetType = FieldType.DECIMAL128) BigDecimal amount,
        Status status, long version, Instant createdAt, Instant updatedAt, List<HistoryEntry> history) {

    public enum Status { PENDING, ACCEPTED, REJECTED }
    public enum Action { PROPOSED, COUNTERED, ACCEPTED, REJECTED }

    public record HistoryEntry(Action action, ObjectId actorId,
            @Field(targetType = FieldType.DECIMAL128) BigDecimal amount, Instant createdAt) {
        public HistoryEntry {
            Objects.requireNonNull(action, "action");
            Objects.requireNonNull(actorId, "actorId");
            validateAmount(amount);
            Objects.requireNonNull(createdAt, "createdAt");
        }
    }

    public OfferNegotiation {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(listingId, "listingId");
        Objects.requireNonNull(buyerId, "buyerId");
        Objects.requireNonNull(sellerId, "sellerId");
        Objects.requireNonNull(currentProposerId, "currentProposerId");
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
        if (buyerId.equals(sellerId) || !(currentProposerId.equals(buyerId) || currentProposerId.equals(sellerId)))
            throw new IllegalArgumentException("Negotiation requires distinct participants and a participant proposer.");
        if (version < 0) throw new IllegalArgumentException("Version must be nonnegative.");
        validateAmount(amount);
        history = List.copyOf(Objects.requireNonNull(history, "history"));
        if (history.isEmpty()) throw new IllegalArgumentException("Proposal history is required.");
    }

    /** Reject amounts BSON Decimal128 cannot store exactly, as well as fractional cents and zero. */
    public static void validateAmount(BigDecimal amount) {
        if (amount == null || amount.signum() <= 0 || amount.scale() > 2)
            throw new IllegalArgumentException("Amount must be positive with at most two decimal places.");
        try {
            new Decimal128(amount);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Amount cannot be stored exactly.", e);
        }
    }

    public static OfferNegotiation create(ObjectId listingId, ObjectId buyerId, ObjectId sellerId,
                                          BigDecimal amount, Instant now) {
        return create(new ObjectId(), listingId, buyerId, sellerId, amount, now);
    }

    public static OfferNegotiation create(ObjectId id, ObjectId listingId, ObjectId buyerId, ObjectId sellerId,
                                          BigDecimal amount, Instant now) {
        return new OfferNegotiation(id, listingId, buyerId, sellerId, buyerId, amount, Status.PENDING, 0,
                now, now, List.of(new HistoryEntry(Action.PROPOSED, buyerId, amount, now)));
    }

    public OfferNegotiation counter(ObjectId actorId, BigDecimal newAmount, long expectedVersion, Instant now) {
        requireResponse(actorId, expectedVersion);
        var next = append(new HistoryEntry(Action.COUNTERED, actorId, newAmount, now));
        return new OfferNegotiation(id, listingId, buyerId, sellerId, actorId, newAmount, Status.PENDING,
                version + 1, createdAt, now, next);
    }

    public OfferNegotiation decide(ObjectId actorId, Status decision, long expectedVersion, Instant now) {
        requireResponse(actorId, expectedVersion);
        if (decision != Status.ACCEPTED && decision != Status.REJECTED)
            throw new IllegalArgumentException("Decision must be ACCEPTED or REJECTED.");
        Action action = decision == Status.ACCEPTED ? Action.ACCEPTED : Action.REJECTED;
        return new OfferNegotiation(id, listingId, buyerId, sellerId, currentProposerId, amount, decision,
                version + 1, createdAt, now, append(new HistoryEntry(action, actorId, amount, now)));
    }

    private void requireResponse(ObjectId actorId, long expectedVersion) {
        if (version != expectedVersion) throw new IllegalStateException("Stale negotiation version.");
        if (status != Status.PENDING) throw new IllegalStateException("Negotiation has already ended.");
        if (actorId == null || (!actorId.equals(buyerId) && !actorId.equals(sellerId)) || actorId.equals(currentProposerId))
            throw new IllegalArgumentException("Only the other participant may respond.");
        if (version == Long.MAX_VALUE) throw new IllegalStateException("Negotiation version exhausted.");
    }

    private List<HistoryEntry> append(HistoryEntry item) {
        List<HistoryEntry> entries = new ArrayList<>(history);
        entries.add(item);
        return entries;
    }
}
