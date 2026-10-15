package edu.augustana.csc305.project.dto;
import java.time.Instant;
import java.math.BigDecimal;
public record ConversationResponse(String id, String currentUserId, Participant participant,
        ListingSummary listing, String lastMessagePreview, Instant createdAt, Instant lastMessageAt, long unreadCount) {
    public record Participant(String name, boolean emailVerified) {}
    public record ListingSummary(String id, String title, BigDecimal price, String listingType, String status, String imageUrl) {}
}
