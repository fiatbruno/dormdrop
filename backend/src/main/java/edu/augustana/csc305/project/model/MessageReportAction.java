package edu.augustana.csc305.project.model;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("messageReportActions")
public record MessageReportAction(
        @Id ObjectId id,
        ObjectId reportId,
        ObjectId actorId,
        String actorName,
        Type type,
        String content,
        String policyReason,
        Integer durationDays,
        Instant expiresAt,
        Instant createdAt
) {
    public enum Type {
        INTERNAL_NOTE,
        DISMISSED,
        WARNING_SENT,
        ACCOUNT_SUSPENDED
    }
}
