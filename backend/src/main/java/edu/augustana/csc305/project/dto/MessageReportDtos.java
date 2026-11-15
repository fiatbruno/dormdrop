package edu.augustana.csc305.project.dto;

import edu.augustana.csc305.project.model.MessageReport;

import java.time.Instant;
import java.util.List;

public final class MessageReportDtos {
    private MessageReportDtos() {}

    public record Receipt(String id, String status, Instant createdAt) {}

    public record Report(
            String id,
            String conversationId,
            String listingId,
            String listingTitle,
            String messageId,
            String messageContent,
            Instant messageSentAt,
            String senderName,
            String senderEmail,
            String reporterName,
            String reporterEmail,
            String reason,
            String details,
            List<ContextMessage> conversationContext,
            Instant createdAt,
            String status
    ) {
        public static Report from(MessageReport report) {
            return new Report(
                    report.id().toHexString(),
                    report.conversationId().toHexString(),
                    report.listingId().toHexString(),
                    report.listingTitle(),
                    report.messageId().toHexString(),
                    report.messageContent(),
                    report.messageSentAt(),
                    report.senderName(),
                    report.senderEmail(),
                    report.reporterName(),
                    report.reporterEmail(),
                    report.reason(),
                    report.details(),
                    report.conversationContext().stream()
                            .map(message -> new ContextMessage(
                                    message.messageId().toHexString(),
                                    message.senderName(),
                                    message.content(),
                                    message.sentAt()))
                            .toList(),
                    report.createdAt(),
                    report.status()
            );
        }
    }

    public record ContextMessage(
            String messageId,
            String senderName,
            String content,
            Instant sentAt
    ) {}
}
