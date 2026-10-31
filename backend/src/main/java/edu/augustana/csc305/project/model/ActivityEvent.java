package edu.augustana.csc305.project.model;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

import static edu.augustana.csc305.project.model.ModerationTypes.*;

@Document(collection = "moderationActivity")
public record ActivityEvent(
        @Id ObjectId id,
        ObjectId caseId,
        ObjectId actorId,
        EventType type,
        ObjectId relatedRecordId,
        ObjectId correctsEventId,
        String internalNote,
        long expectedCaseVersion,
        Instant createdAt
) {}