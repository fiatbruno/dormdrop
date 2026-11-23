package edu.augustana.csc305.project.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public final class MessageReportActionDtos {
    private MessageReportActionDtos() {}

    public record NoteRequest(
            @NotBlank @Size(max = 2000) String content
    ) {}

    public record DismissRequest(
            @NotBlank @Size(max = 500) String reason,
            @NotBlank @Size(max = 2000) String internalNote
    ) {}

    public record WarningRequest(
            @NotBlank @Size(max = 500) String policyReason,
            @NotBlank @Size(max = 2000) String message
    ) {}

    public record SuspensionRequest(
            @Min(1) @Max(30) int durationDays,
            @NotBlank @Size(max = 500) String policyReason,
            @NotBlank @Size(max = 2000) String message
    ) {}

    public record Receipt(String reportId, String status, Instant createdAt, Instant expiresAt,
                         long hiddenListings) {}

    public record MemberNotice(String message, Instant suspendedUntil) {}

    public record InternalNote(String authorName, String content, Instant createdAt) {}

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
            List<MessageReportDtos.ContextMessage> conversationContext,
            Instant createdAt,
            String status,
            List<InternalNote> internalNotes,
            Instant suspensionExpiresAt,
            long hiddenListings
    ) {}
}
