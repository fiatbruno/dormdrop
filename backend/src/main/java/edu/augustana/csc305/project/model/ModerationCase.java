package edu.augustana.csc305.project.model;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Locale;

import static edu.augustana.csc305.project.model.ModerationTypes.*;

@Document(collection = "moderationCases")
public record ModerationCase(
        @Id ObjectId id,
        String referenceNumber,
        ObjectId listingId,
        ObjectId previousCaseId,
        CaseStatus status,
        Priority priority,
        ObjectId assignedTo,
        Instant createdAt,
        Instant updatedAt,
        @Version Long version
) {
    public static ModerationCase open(
            ObjectId listingId,
            ObjectId previousCaseId
    ) {
        if (listingId == null) {
            throw new IllegalArgumentException("Listing ID is required.");
        }

        ObjectId id = new ObjectId();
        Instant now = Instant.now();

        String reference = "RPT-"
                + id.toHexString().toUpperCase(Locale.ROOT);

        return new ModerationCase(
                id,
                reference,
                listingId,
                previousCaseId,
                CaseStatus.OPEN,
                Priority.MEDIUM,
                null,
                now,
                now,
                null
        );
    }
}
