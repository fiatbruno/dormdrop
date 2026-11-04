
package edu.augustana.csc305.project.model;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;

@Document("notifications")
public record PrivateNotification(
        @Id String id, ObjectId recipientId, String sourceEventKey, ObjectId sourceEventId,
        Type type, ObjectId offerId, ObjectId listingId, Payload payload,
        Instant createdAt, Instant readAt) {

    public enum Type {
        OFFER_RECEIVED, OFFER_ACCEPTED, OFFER_REJECTED,
        OFFER_COUNTERED, MODERATION_NOTICE, REPORT_UPDATE
    }

    public enum Status {
        PENDING, ACCEPTED, REJECTED, COUNTERED,
        KEPT, HIDDEN, REMOVED
    }

    public record Payload(
            String message,
            Status status,
            BigDecimal price,
            String buyerDisplayName,
            String reason,
            edu.augustana.csc305.project.dto.ModerationDtos.ReporterStatus report,
            String link
    ) {
        public Payload(String message, Status status, BigDecimal price) {
            this(message, status, price, null, null, null, null);
        }

        public Payload(String message, Status status, BigDecimal price,
                       String buyerDisplayName) {
            this(message, status, price, buyerDisplayName, null, null, null);
        }

        public Payload(String message, Status status, BigDecimal price,
                       String reason,
                       edu.augustana.csc305.project.dto.ModerationDtos.ReporterStatus report,
                       String link) {
            this(message, status, price, null, reason, report, link);
        }

        public Payload {
            Objects.requireNonNull(status, "Notification status is required.");

            if (message == null || message.isBlank() || message.length() > 2000)
                throw new IllegalArgumentException(
                    "Notification message must contain 1 to 2000 characters."
                );

            if (price != null &&
                (price.signum() < 0 || price.precision() > 18 || price.scale() > 2))
                throw new IllegalArgumentException("Invalid notification price.");

            if (buyerDisplayName != null &&
                (buyerDisplayName.isBlank() ||
                 buyerDisplayName.length() > 100 ||
                 buyerDisplayName.codePoints().anyMatch(Character::isISOControl)))
                throw new IllegalArgumentException("Invalid buyer display name.");
        }
    }
}
