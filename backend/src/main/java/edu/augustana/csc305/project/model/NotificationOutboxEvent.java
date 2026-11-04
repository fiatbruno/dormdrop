package edu.augustana.csc305.project.model;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Objects;

/**
 * #53 producer contract: insert in the SAME transaction as the domain command, never afterward.
 * eventKey is the stable, globally unique source event key, reused on command replay.
 * One event targets one recipient; a fan-out command emits a distinct event key for each target.
 * The worker reads committed records only. PENDING -> PROCESSING -> DONE, or RETRY with a lease.
 * Command actor/action/request-key replay and payload-conflict checks belong to #53, not this inbox.
 */
@Document("notificationOutbox")
public record NotificationOutboxEvent(
        @Id ObjectId id, String eventKey, ObjectId recipientId, PrivateNotification.Type type,
        ObjectId offerId, ObjectId listingId, PrivateNotification.Payload payload,
        Instant createdAt, String status) {

    public NotificationOutboxEvent {
        Objects.requireNonNull(id);
        Objects.requireNonNull(recipientId);
        Objects.requireNonNull(type);
        Objects.requireNonNull(payload);
        Objects.requireNonNull(createdAt);
        if (eventKey == null || eventKey.isBlank() || eventKey.length() > 200)
            throw new IllegalArgumentException("Event key must contain 1 to 200 characters.");
        if (status == null || !java.util.Set.of("PENDING", "PROCESSING", "RETRY", "DONE").contains(status))
            throw new IllegalArgumentException("Invalid outbox state.");
        boolean valid = switch (type) {
            case OFFER_RECEIVED -> offerId != null && listingId != null
                    && payload.status() == PrivateNotification.Status.PENDING
                    && payload.price() != null && payload.price().signum() > 0 && payload.buyerDisplayName() != null;
            case OFFER_ACCEPTED -> offerId != null && payload.status() == PrivateNotification.Status.ACCEPTED && payload.price() != null;
            case OFFER_REJECTED -> offerId != null && payload.status() == PrivateNotification.Status.REJECTED && payload.price() != null;
            case OFFER_COUNTERED -> offerId != null && payload.status() == PrivateNotification.Status.COUNTERED && payload.price() != null;
            case MODERATION_NOTICE, REPORT_UPDATE -> java.util.Set.of(PrivateNotification.Status.KEPT,
                    PrivateNotification.Status.HIDDEN, PrivateNotification.Status.REMOVED).contains(payload.status());
        };
        if (!valid) throw new IllegalArgumentException("Notification type and safe payload do not agree.");
    }
}
