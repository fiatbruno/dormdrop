
package edu.augustana.csc305.project.dto;

import edu.augustana.csc305.project.model.CompletedTransaction;
import java.time.Instant;

public record CompletedTransactionResponse(
        String id,
        String offerId,
        String listingId,
        String buyerId,
        String sellerId,
        String conversationId,
        String pickupProposalId,
        String status,
        Instant completedAt,
        CompletedTransaction.SellerReview sellerReview
) {
    public static CompletedTransactionResponse from(
            CompletedTransaction transaction
    ) {
        return new CompletedTransactionResponse(
                transaction.getId().toHexString(),
                transaction.getOfferId().toHexString(),
                transaction.getListingId().toHexString(),
                transaction.getBuyerId().toHexString(),
                transaction.getSellerId().toHexString(),
                transaction.getConversationId().toHexString(),
                transaction.getPickupProposalId().toHexString(),
                "COMPLETED",
                transaction.getCompletedAt(),
                transaction.getSellerReview()
        );
    }
}
