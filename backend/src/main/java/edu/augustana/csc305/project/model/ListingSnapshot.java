package edu.augustana.csc305.project.model;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Document(collection = "listingSnapshots")
public record ListingSnapshot(
        @Id ObjectId id,
        ObjectId caseId,
        ObjectId listingId,
        ObjectId sellerId,
        String sellerDisplayName,
        Long sourceListingVersion,
        String title,
        String description,
        String category,
        @Field(targetType = FieldType.DECIMAL128)
        BigDecimal price,
        String condition,
        String pickupArea,
        String listingType,
        ListingStatus lifecycleStatus,
        List<String> privateEvidenceKeys,
        Instant capturedAt
) {
    public ListingSnapshot {
        privateEvidenceKeys = privateEvidenceKeys == null
                ? List.of()
                : List.copyOf(privateEvidenceKeys);
    }
}