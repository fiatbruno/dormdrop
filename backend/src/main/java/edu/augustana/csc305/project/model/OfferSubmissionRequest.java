package edu.augustana.csc305.project.model;

import java.math.BigDecimal;
import java.time.Instant;
import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

/** Durable idempotency record and original response for an accepted offer command. */
@Document("offerSubmissionRequests")
public record OfferSubmissionRequest(@Id String id, ObjectId listingId,
        @Field(targetType = FieldType.DECIMAL128) BigDecimal amount,
        OfferNegotiation result, Instant createdAt) { }
