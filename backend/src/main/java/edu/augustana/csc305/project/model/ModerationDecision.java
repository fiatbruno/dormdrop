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
        Instant createdAt
) {}
