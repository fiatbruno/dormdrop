package edu.augustana.csc305.project.dto;

import edu.augustana.csc305.project.model.ModerationTypes.*;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.math.BigDecimal;
import edu.augustana.csc305.project.model.ListingStatus;
import java.util.List;

public final class StaffCaseDtos {
    private StaffCaseDtos() {}
    public record Assignment(@NotNull @Min(0) Long expectedVersion, String assigneeId) {}
    public record CaseSummary(String caseId, String referenceNumber, String listingId, String previousCaseId,
                              CaseStatus status, Priority priority, String assignedTo, Long version,
                              Instant createdAt, Instant updatedAt, long reportCount) {}
    public record QueuePage(List<CaseSummary> items, long total, int page, int size, long totalPages) {}
    public record SellerContext(String sellerId, String displayName) {}
    public record SnapshotMetadata(String id, String listingId, String sellerId, Long listingVersion,
                                    String title, String description, BigDecimal price, String category,
                                    ListingStatus lifecycleStatus, Instant capturedAt, List<String> mediaKeys) {}
    public record ReportGroup(String snapshotId, List<ModerationDtos.StaffReport> reports) {}
    public record StaffActivity(String eventId, String actorId, EventType type, String relatedRecordId,
                                String correctsEventId, String internalNote, Instant createdAt) {}
    public record CaseDetail(CaseSummary caseSummary, List<ReportGroup> reportGroups,
                             List<SnapshotMetadata> snapshots,
                             SellerContext seller, List<ModerationDtos.StaffDecision> decisions,
                             List<StaffActivity> activity) {}
}
