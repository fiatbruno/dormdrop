package edu.augustana.csc305.project.model;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.List;

/** Durable integration event for #53. Deduplicate deliveries by (event ID, recipient ID, audience).
 * Send only sellerMessage to the seller and reporterMessage to reporters; never expose the raw outbox document.
 * Internal rationale is not included in this event. */
@Document("moderationNotificationOutbox")
public record ModerationNotificationEvent(@Id ObjectId id, ObjectId decisionId, ObjectId caseId,
        ObjectId listingId, ObjectId sellerRecipientId, List<ObjectId> reporterRecipientIds,
        ModerationTypes.DecisionAction action, String sellerMessage, String reporterMessage,
        String status, Instant createdAt) {
    public ModerationNotificationEvent { reporterRecipientIds = List.copyOf(reporterRecipientIds); }
}
