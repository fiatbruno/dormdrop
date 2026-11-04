package edu.augustana.csc305.project.model;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

import static edu.augustana.csc305.project.model.ModerationTypes.*;

@Document(collection = "moderationDecisions")
public record ModerationDecision(
        @Id ObjectId id,
        ObjectId caseId,
        ObjectId staffId,
        DecisionAction action,
        String internalRationale,
        String sellerMessage,
        String reporterMessage,
        ObjectId correctsDecisionId,
        long expectedCaseVersion,
        Instant createdAt,
        String policyReason,
        Long expectedListingVersion,
        ObjectId snapshotId,
        java.util.List<ObjectId> reviewedReportIds
) {
    public ModerationDecision {
        reviewedReportIds = reviewedReportIds == null ? java.util.List.of() : java.util.List.copyOf(reviewedReportIds);
    }
    // Historical records and append-only corrections remain readable without rewriting them.
    public ModerationDecision(ObjectId id, ObjectId caseId, ObjectId staffId, DecisionAction action,
            String internalRationale, String sellerMessage, String reporterMessage, ObjectId correctsDecisionId,
            long expectedCaseVersion, Instant createdAt) {
        this(id, caseId, staffId, action, internalRationale, sellerMessage, reporterMessage, correctsDecisionId,
                expectedCaseVersion, createdAt, null, null, null, java.util.List.of());
    }
}
