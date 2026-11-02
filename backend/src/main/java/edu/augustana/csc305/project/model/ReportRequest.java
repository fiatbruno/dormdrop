package edu.augustana.csc305.project.model;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;

/** Reporter-scoped idempotency ledger, committed with the report. Never exposed to clients. */
@Document("reportRequests")
public record ReportRequest(@Id String id, ObjectId listingId,
                            ModerationTypes.ReportCategory category, String description,
                            ObjectId reportId, Instant createdAt) {}
