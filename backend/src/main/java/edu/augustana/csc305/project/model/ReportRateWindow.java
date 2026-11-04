package edu.augustana.csc305.project.model;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;

/** Fixed window for newly accepted reports, shared by all backend instances. */
@Document("reportRateWindows")
public record ReportRateWindow(@Id ObjectId reporterId, Instant startedAt, int count) {}
