package edu.augustana.csc305.project.model;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Document(collection = "message_reports")
public record MessageReport(
        @Id ObjectId id,
        ObjectId conversationId,
        ObjectId listingId,
        String listingTitle,
        ObjectId messageId,
        String messageContent,
        Instant messageSentAt,
        ObjectId senderId,
        String senderName,
        String senderEmail,
        ObjectId reporterId,
        String reporterName,
        String reporterEmail,
        String reason,
        String details,
        List<ContextMessage> conversationContext,
        Instant createdAt,
        String status
) {
    public record ContextMessage(
            ObjectId messageId,
            String senderName,
            String content,
            Instant sentAt
    ) {}
}
