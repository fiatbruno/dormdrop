package edu.augustana.csc305.project.service;

import com.mongodb.client.result.UpdateResult;
import edu.augustana.csc305.project.model.NotificationOutboxEvent;
import edu.augustana.csc305.project.model.PrivateNotification;
import org.bson.types.ObjectId;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.mongodb.MongoDatabaseUtils;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Objects;


@Service
public class OfferTransitionEventAppender {
    public enum Action { ACCEPT, REJECT, COUNTER }

    public record Transition(ObjectId offerId, ObjectId listingId, ObjectId buyerId, ObjectId sellerId,
                             ObjectId actorId, ObjectId currentProposerId, Action action, BigDecimal latestPrice,
                             long expectedVersion, long resultingVersion, Instant occurredAt) {
        public Transition {
            Objects.requireNonNull(offerId);
            Objects.requireNonNull(listingId);
            Objects.requireNonNull(buyerId);
            Objects.requireNonNull(sellerId);
            Objects.requireNonNull(actorId);
            Objects.requireNonNull(currentProposerId);
            Objects.requireNonNull(action);
            Objects.requireNonNull(occurredAt);
            if (buyerId.equals(sellerId) || !(actorId.equals(buyerId) || actorId.equals(sellerId)))
                throw new IllegalArgumentException("Actor must be one of two distinct offer participants.");
            if (!(currentProposerId.equals(buyerId) || currentProposerId.equals(sellerId)) || actorId.equals(currentProposerId))
                throw new IllegalArgumentException("Actor must answer the other participant's current proposal.");
            if (expectedVersion < 0 || expectedVersion == Long.MAX_VALUE || resultingVersion != expectedVersion + 1)
                throw new IllegalArgumentException("Transition must advance the expected offer version once.");
            if (latestPrice == null || latestPrice.signum() <= 0 || latestPrice.scale() > 2)
                throw new IllegalArgumentException("Offer price must be positive with at most two decimal places.");
            latestPrice = latestPrice.setScale(2);
            occurredAt = occurredAt.truncatedTo(ChronoUnit.MILLIS);
        }
    }

    private final MongoTemplate mongo;

    public OfferTransitionEventAppender(MongoTemplate mongo) { this.mongo = mongo; }

    public NotificationOutboxEvent append(Transition transition, UpdateResult commandWrite) {
        Objects.requireNonNull(transition);
        Objects.requireNonNull(commandWrite);
        if (!MongoDatabaseUtils.isTransactionActive(mongo.getMongoDatabaseFactory()))
            throw new IllegalStateException("Offer transition and event require the same MongoDB transaction.");
        if (!commandWrite.wasAcknowledged() || commandWrite.getMatchedCount() != 1 || commandWrite.getModifiedCount() != 1)
            throw new OptimisticLockingFailureException("Offer changed. Reload it before trying again.");

        ObjectId recipient = transition.actorId().equals(transition.sellerId()) ? transition.buyerId() : transition.sellerId();
        var type = switch (transition.action()) {
            case ACCEPT -> PrivateNotification.Type.OFFER_ACCEPTED;
            case REJECT -> PrivateNotification.Type.OFFER_REJECTED;
            case COUNTER -> PrivateNotification.Type.OFFER_COUNTERED;
        };
        var status = switch (transition.action()) {
            case ACCEPT -> PrivateNotification.Status.ACCEPTED;
            case REJECT -> PrivateNotification.Status.REJECTED;
            case COUNTER -> PrivateNotification.Status.COUNTERED;
        };
        String message = switch (transition.action()) {
            case ACCEPT -> "The other participant accepted the offer.";
            case REJECT -> "The other participant declined the offer.";
            case COUNTER -> "You received a counteroffer.";
        };
        var payload = new PrivateNotification.Payload(message, status, transition.latestPrice());
        // Excluding the action from this key prevents contradictory events for the same version.
        String key = "offer:" + transition.offerId().toHexString() + ":transition:" + transition.resultingVersion();
        var prior = mongo.findOne(Query.query(Criteria.where("eventKey").is(key)), NotificationOutboxEvent.class);
        if (prior != null) {
            if (!prior.recipientId().equals(recipient) || prior.type() != type
                    || !Objects.equals(prior.offerId(), transition.offerId())
                    || !Objects.equals(prior.listingId(), transition.listingId())
                    || !prior.payload().equals(payload) || !prior.createdAt().equals(transition.occurredAt()))
                throw new IllegalStateException("Offer transition replay differs from its original event.");
            return prior;
        }
        return mongo.insert(new NotificationOutboxEvent(new ObjectId(), key, recipient, type,
                transition.offerId(), transition.listingId(), payload, transition.occurredAt(), "PENDING"));
    }
}
