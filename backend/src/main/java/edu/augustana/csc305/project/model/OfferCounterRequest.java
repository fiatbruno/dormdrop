package edu.augustana.csc305.project.model;

import java.math.BigDecimal;
import java.time.Instant;
import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

/** Original result of a counteroffer, keyed by actor and request key. */
@Document("offerCounterRequests")
public record OfferCounterRequest(@Id String id, ObjectId offerId,
        @Field(targetType = FieldType.DECIMAL128) BigDecimal amount,
        long expectedVersion, OfferNegotiation result, Instant createdAt) { }
