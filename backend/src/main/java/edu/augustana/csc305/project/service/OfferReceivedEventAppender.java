package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.model.NotificationOutboxEvent;
import edu.augustana.csc305.project.model.PrivateNotification;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.MongoDatabaseUtils;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;

/**
 * Integration point for #60: after validation and offer insertion, call append in that SAME Mongo
 * transaction, before committing the command's idempotent result. Never call from a controller or
 * after commit. Supply persisted offer/listing/user values, not client-supplied participant IDs.
 * #60 owns request-key replay, listing eligibility, pending-negotiation uniqueness and transaction
 * retries. On replay it must reuse the original offer ID and submitted values, not insert an offer.
 * No offer command exists on this branch yet; this component does not implement #60's API.
 */
@Service
public class OfferReceivedEventAppender {
    private final MongoTemplate mongo;

    public OfferReceivedEventAppender(MongoTemplate mongo) { this.mongo = mongo; }

    /** Server-side snapshot of the successful submission, captured by #60's command. */
    public record Submission(ObjectId offerId, ObjectId listingId, ObjectId buyerId, ObjectId sellerId,
                             String buyerDisplayName, BigDecimal amount, Instant submittedAt) {
        public Submission {
            Objects.requireNonNull(offerId);
            Objects.requireNonNull(listingId);
            Objects.requireNonNull(buyerId);
            Objects.requireNonNull(sellerId);
            Objects.requireNonNull(submittedAt);
            if (buyerId.equals(sellerId)) throw new IllegalArgumentException("Buyer cannot be the seller.");
            if (amount == null || amount.signum() <= 0 || amount.scale() > 2 || amount.precision() > 18)
                throw new IllegalArgumentException("Offer amount must be positive with at most two decimal places.");
            amount = amount.setScale(2);
            submittedAt = submittedAt.truncatedTo(java.time.temporal.ChronoUnit.MILLIS);
            buyerDisplayName = safeDisplayName(buyerDisplayName);
        }
    }

    public NotificationOutboxEvent append(Submission offer) {
        Objects.requireNonNull(offer);
        if (!MongoDatabaseUtils.isTransactionActive(mongo.getMongoDatabaseFactory()))
            throw new IllegalStateException("Offer and OFFER_RECEIVED must be saved in the same MongoDB transaction.");

        String key = "offer:" + offer.offerId().toHexString() + ":received";
        var payload = new PrivateNotification.Payload("You received a new offer.", PrivateNotification.Status.PENDING,
                offer.amount(), offer.buyerDisplayName());
        var prior = mongo.findOne(Query.query(Criteria.where("eventKey").is(key)), NotificationOutboxEvent.class);
        if (prior != null) {
            if (!prior.recipientId().equals(offer.sellerId()) || prior.type() != PrivateNotification.Type.OFFER_RECEIVED
                    || !Objects.equals(prior.offerId(), offer.offerId()) || !Objects.equals(prior.listingId(), offer.listingId())
                    || !prior.payload().equals(payload) || !prior.createdAt().equals(offer.submittedAt()))
                throw new IllegalStateException("Offer notification replay does not match the original submission.");
            return prior;
        }
        return mongo.insert(new NotificationOutboxEvent(new ObjectId(), key, offer.sellerId(),
                PrivateNotification.Type.OFFER_RECEIVED, offer.offerId(), offer.listingId(), payload,
                offer.submittedAt(), "PENDING"));
    }

    private static String safeDisplayName(String name) {
        if (name == null || name.isBlank()) return "A buyer";
        String cleaned = name.codePoints().filter(cp -> !Character.isISOControl(cp)
                        && Character.getType(cp) != Character.FORMAT)
                .collect(StringBuilder::new, StringBuilder::appendCodePoint, StringBuilder::append).toString().strip();
        if (cleaned.isBlank()) return "A buyer";
        int end = Math.min(100, cleaned.length());
        if (end < cleaned.length() && Character.isHighSurrogate(cleaned.charAt(end - 1))) end--;
        return cleaned.substring(0, end);
    }
}
