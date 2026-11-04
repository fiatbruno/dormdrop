package edu.augustana.csc305.project.model;

import edu.augustana.csc305.project.dto.ModerationDtos;
import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;

/** Private storage envelope. Recipient/event IDs and worker state are excluded by explicit DTO mapping. */
@Document("notifications")
public record NotificationInboxEntry(@Id String id, ObjectId recipientId, String audience, ObjectId sourceEventId,
        ModerationTypes.DecisionAction outcome, String reason, String message,
        ModerationDtos.ReporterStatus reportStatus, Instant createdAt, Instant readAt) {}
