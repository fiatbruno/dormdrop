
package edu.augustana.csc305.project.model;

import java.time.Instant;
import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("completedTransactions")
public class CompletedTransaction {

    @Id
    private ObjectId id;
    private ObjectId offerId;
    private ObjectId listingId;
    private ObjectId buyerId;
    private ObjectId sellerId;
    private ObjectId conversationId;
    private ObjectId pickupProposalId;
    private Instant completedAt;
    private SellerReview sellerReview;

    public record SellerReview(int rating, String comment, Instant submittedAt) {}

    public CompletedTransaction() {
    }

    public CompletedTransaction(
            ObjectId offerId,
            ObjectId listingId,
            ObjectId buyerId,
            ObjectId sellerId,
            ObjectId conversationId,
            ObjectId pickupProposalId,
            Instant completedAt
    ) {
        this.id = new ObjectId();
        this.offerId = offerId;
        this.listingId = listingId;
        this.buyerId = buyerId;
        this.sellerId = sellerId;
        this.conversationId = conversationId;
        this.pickupProposalId = pickupProposalId;
        this.completedAt = completedAt;
    }

    public ObjectId getId() {
        return id;
    }

    public ObjectId getOfferId() {
        return offerId;
    }

    public ObjectId getListingId() {
        return listingId;
    }

    public ObjectId getBuyerId() {
        return buyerId;
    }

    public ObjectId getSellerId() {
        return sellerId;
    }

    public ObjectId getConversationId() {
        return conversationId;
    }

    public ObjectId getPickupProposalId() {
        return pickupProposalId;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public SellerReview getSellerReview() {
        return sellerReview;
    }
}
