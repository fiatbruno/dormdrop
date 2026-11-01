package edu.augustana.csc305.project.dto;

import edu.augustana.csc305.project.model.*;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;

import static edu.augustana.csc305.project.model.ModerationTypes.*;

public final class ModerationDtos {
    private ModerationDtos() {}

    public record VersionedRequest(
            @NotNull @Min(0) Long expectedVersion
    ) {}

    public record ReporterStatus(
            String reportId,
            String referenceNumber,
            CaseStatus status,
            Instant submittedAt
    ) {}

    // No reporter IDs, staff rationale, or evidence-storage keys.
    public record SellerNotice(
            String referenceNumber,
            DecisionAction action,
            String message,
            Instant decidedAt
    ) {}

    public record StaffReport(
            String reportId,
            String reporterId,
            String snapshotId,
            ReportCategory category,
            String description,
            Instant submittedAt
    ) {}

    public record StaffEvidence(
            String snapshotId,
            String listingId,
            String sellerId,
            String sellerDisplayName,
            String title,
            String description,
            List<String> privateEvidenceKeys,
            Instant capturedAt
    ) {
        public StaffEvidence {
            privateEvidenceKeys = privateEvidenceKeys == null
                    ? List.of()
                    : List.copyOf(privateEvidenceKeys);
        }
    }

    public record StaffDecision(
            String decisionId,
            String staffId,
            DecisionAction action,
            String internalRationale,
            String correctsDecisionId,
            Instant createdAt
    ) {}

    public static ReporterStatus reporterStatus(
            Report report,
            ModerationCase reportCase
    ) {
        if (!report.caseId().equals(reportCase.id())) {
            throw new IllegalArgumentException("Report/case mismatch.");
        }

        return new ReporterStatus(
                report.id().toHexString(),
                reportCase.referenceNumber(),
                reportCase.status(),
                report.createdAt()
        );
    }

    public static SellerNotice sellerNotice(
            ModerationDecision decision,
            ModerationCase reportCase
    ) {
        if (!decision.caseId().equals(reportCase.id())) {
            throw new IllegalArgumentException("Decision/case mismatch.");
        }

        return new SellerNotice(
                reportCase.referenceNumber(),
                decision.action(),
                decision.sellerMessage(),
                decision.createdAt()
        );
    }
}