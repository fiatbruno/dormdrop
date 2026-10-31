package edu.augustana.csc305.project.model;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

import static edu.augustana.csc305.project.model.ModerationTypes.*;

@Document(collection = "reports")
public record Report(
        @Id ObjectId id,
        ObjectId caseId,
        ObjectId listingId,
        ObjectId reporterId,
        ObjectId snapshotId,
        ReportCategory category,
        String description,
        String requestId,
        Instant createdAt
) {}