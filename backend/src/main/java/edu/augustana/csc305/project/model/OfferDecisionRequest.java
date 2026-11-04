package edu.augustana.csc305.project.model;

import java.time.Instant;
import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/** Original response for a decision, keyed by authenticated actor and request key. */
@Document("offerDecisionRequests")
public record OfferDecisionRequest(@Id String id, ObjectId offerId, OfferNegotiation.Status decision,
        long expectedVersion, OfferNegotiation result, Instant createdAt) { }
