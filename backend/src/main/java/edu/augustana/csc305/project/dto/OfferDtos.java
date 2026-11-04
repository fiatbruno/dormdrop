package edu.augustana.csc305.project.dto;

import edu.augustana.csc305.project.model.OfferNegotiation;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Participant-facing offer representations, with no user documents or credentials. */
public final class OfferDtos {
    private OfferDtos() {}

    public record Submit(BigDecimal amount) {}
    public record Decision(String action, Long expectedVersion) {}
    public record Counter(BigDecimal amount, Long expectedVersion) {}
    public record History(OfferNegotiation.Action action, String actorId, BigDecimal amount, Instant createdAt) {}
    public record Offer(String id, String listingId, String buyerId, String sellerId, String currentProposerId,
                        BigDecimal amount, OfferNegotiation.Status status, long version,
                        Instant createdAt, Instant updatedAt, Instant expiresAt, List<History> history) {}
    public record Page(List<Offer> items, long total, int page, int size) {}

    public static Offer from(OfferNegotiation offer) {
        return new Offer(offer.id().toHexString(), offer.listingId().toHexString(), offer.buyerId().toHexString(),
                offer.sellerId().toHexString(), offer.currentProposerId().toHexString(), offer.amount(),
                offer.isExpired(Instant.now()) ? OfferNegotiation.Status.EXPIRED : offer.status(),
                offer.version(), offer.createdAt(), offer.updatedAt(), offer.expiresAt(), offer.history().stream()
                        .map(entry -> new History(entry.action(), entry.actorId().toHexString(), entry.amount(), entry.createdAt()))
                        .toList());
    }
}
