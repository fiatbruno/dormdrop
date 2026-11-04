package edu.augustana.csc305.project.dto;

import edu.augustana.csc305.project.model.ModerationTypes.DecisionAction;
import java.time.Instant;
import java.util.List;

/** Inbox/live delivery contracts. Raw outbox, decision, and inbox documents are never serialized. */
public final class NotificationDtos {
    private NotificationDtos() {}
    public sealed interface Notice permits SellerNotice, ReporterUpdate {}
    public record SellerNotice(String id, String type, DecisionAction outcome, String reason, String message,
                                String link, Instant createdAt, Instant readAt) implements Notice {}
    public record ReporterUpdate(String id, String type, DecisionAction outcome, String message, String link,
                                  ModerationDtos.ReporterStatus report, Instant createdAt, Instant readAt) implements Notice {}
    public record InboxPage(List<Notice> items, long total, long unread, int page, int size) {}
}
