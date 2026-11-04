package edu.augustana.csc305.project.dto;

import edu.augustana.csc305.project.model.PrivateNotification;
import java.time.Instant;
import java.util.List;

/** Deliberately excludes recipient identity, source keys, worker state and internal event fields. */
public record NotificationResponse(
        String id, PrivateNotification.Type type, String offerId, String listingId,
        PrivateNotification.Payload payload, Instant createdAt, Instant readAt, String eventId) {
    public NotificationResponse(String id, PrivateNotification.Type type, String offerId, String listingId,
                                PrivateNotification.Payload payload, Instant createdAt, Instant readAt) {
        this(id, type, offerId, listingId, payload, createdAt, readAt, null);
    }
    public static NotificationResponse from(PrivateNotification notice) {
        return new NotificationResponse(notice.id(), notice.type(),
                notice.offerId() == null ? null : notice.offerId().toHexString(),
                notice.listingId() == null ? null : notice.listingId().toHexString(),
                notice.payload(), notice.createdAt(), notice.readAt(),
                notice.sourceEventId() == null ? null : notice.sourceEventId().toHexString());
    }
    public record Page(List<NotificationResponse> items, long total, long unreadCount, int page, int size) {}
    public record UnreadCount(long count) {}
}
