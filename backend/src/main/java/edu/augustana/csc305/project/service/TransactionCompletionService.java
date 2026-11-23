
package edu.augustana.csc305.project.service;

import com.mongodb.MongoException;
import edu.augustana.csc305.project.model.CompletedTransaction;
import edu.augustana.csc305.project.model.Conversation;
import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.model.ListingStatus;
import edu.augustana.csc305.project.model.OfferNegotiation;
import edu.augustana.csc305.project.model.PickupProposal;
import edu.augustana.csc305.project.model.PickupStatus;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.UserRepository;

import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.locks.LockSupport;

import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.TransactionException;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TransactionCompletionService {

    private static final ZoneId CAMPUS_ZONE =
            ZoneId.of("America/Chicago");

    private static final int MAX_ATTEMPTS = 8;

    private final MongoTemplate mongo;
    private final UserRepository users;
    private final TransactionOperations transactions;

    public TransactionCompletionService(
            MongoTemplate mongo,
            UserRepository users,
            @Qualifier("reportTransactions")
            TransactionOperations transactions
    ) {
        this.mongo = mongo;
        this.users = users;
        this.transactions = transactions;
    }

    public CompletedTransaction confirmReceipt(
            String offerId,
            Authentication authentication
    ) {
        User buyer = currentUser(authentication);
        ObjectId id = parseId(offerId);

        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            try {
                return Objects.requireNonNull(
                        transactions.execute(status ->
                                completeTransaction(id, buyer.getId())
                        )
                );
            } catch (DuplicateKeyException exception) {
                CompletedTransaction existing = findByOffer(id);

                if (existing != null
                        && buyer.getId().equals(existing.getBuyerId())) {
                    return existing;
                }

                throw error(
                        HttpStatus.CONFLICT,
                        "This listing already has a completed transaction."
                );
            } catch (DataAccessException | TransactionException exception) {
                CompletedTransaction existing = findByOffer(id);

                if (existing != null
                        && buyer.getId().equals(existing.getBuyerId())) {
                    return existing;
                }

                if (!retryable(exception)) {
                    throw error(
                            HttpStatus.SERVICE_UNAVAILABLE,
                            "Transaction confirmation failed."
                    );
                }

                if (attempt == MAX_ATTEMPTS - 1) {
                    break;
                }

                LockSupport.parkNanos(
                        ThreadLocalRandom.current()
                                .nextLong(10, 51) * 1_000_000L
                );
            }
        }

        CompletedTransaction existing = findByOffer(id);

        if (existing != null
                && buyer.getId().equals(existing.getBuyerId())) {
            return existing;
        }

        throw error(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Confirmation could not be completed. Please try again."
        );
    }

    private CompletedTransaction completeTransaction(
            ObjectId offerId,
            ObjectId buyerId
    ) {
        OfferNegotiation offer = mongo.findById(
                offerId,
                OfferNegotiation.class
        );

        if (offer == null) {
            throw error(
                    HttpStatus.NOT_FOUND,
                    "Offer not found."
            );
        }

        if (!buyerId.equals(offer.buyerId())) {
            throw error(
                    HttpStatus.FORBIDDEN,
                    "Only the buyer can confirm receipt."
            );
        }

        CompletedTransaction existing = findByOffer(offerId);

        if (existing != null) {
            return existing;
        }

        if (offer.status() != OfferNegotiation.Status.ACCEPTED) {
            throw error(
                    HttpStatus.CONFLICT,
                    "The offer must be accepted first."
            );
        }

        Query conversationQuery = Query.query(
                Criteria.where("listingId")
                        .is(offer.listingId())
                        .and("buyerId")
                        .is(offer.buyerId())
                        .and("sellerId")
                        .is(offer.sellerId())
        );

        Conversation conversation = mongo.findOne(
                conversationQuery,
                Conversation.class
        );

        if (conversation == null) {
            throw error(
                    HttpStatus.CONFLICT,
                    "No matching conversation exists."
            );
        }

        Query pickupQuery = Query.query(
                Criteria.where("conversationId")
                        .is(conversation.getId())
        );

        pickupQuery.with(
                Sort.by(
                        Sort.Order.desc("timeCreated"),
                        Sort.Order.desc("_id")
                )
        );

        PickupProposal pickup = mongo.findOne(
                pickupQuery,
                PickupProposal.class
        );

        if (pickup == null
                || pickup.getStatus() != PickupStatus.ACCEPTED) {
            throw error(
                    HttpStatus.CONFLICT,
                    "An accepted pickup arrangement is required."
            );
        }

        if (pickup.getTimePickUp() == null) {
            throw error(
                    HttpStatus.CONFLICT,
                    "The agreed pickup time is missing."
            );
        }

        Instant now = Instant.now();

        Instant pickupTime = pickup.getTimePickUp()
                .atZone(CAMPUS_ZONE)
                .toInstant();

        if (now.isBefore(pickupTime)) {
            throw error(
                    HttpStatus.CONFLICT,
                    "Receipt cannot be confirmed before pickup."
            );
        }

        Listing listing = mongo.findById(
                offer.listingId(),
                Listing.class
        );

        if (listing == null) {
            throw error(
                    HttpStatus.NOT_FOUND,
                    "Listing not found."
            );
        }

        if (!offer.sellerId().equals(listing.getOwnerId())) {
            throw error(
                    HttpStatus.CONFLICT,
                    "Listing owner does not match the seller."
            );
        }

        ListingStatus currentStatus = listing.getStatus();

        if (currentStatus != ListingStatus.RESERVED
                && currentStatus != ListingStatus.AVAILABLE) {
            throw error(
                    HttpStatus.CONFLICT,
                    "Listing cannot be completed in its current state."
            );
        }

        Criteria expectedStatus = Criteria.where("status").is(currentStatus);
        if (currentStatus == ListingStatus.AVAILABLE) {
            expectedStatus = new Criteria().orOperator(expectedStatus, Criteria.where("status").exists(false));
        }
        Criteria expected = new Criteria().andOperator(
                Criteria.where("_id")
                        .is(listing.getId()),
                Criteria.where("ownerId")
                        .is(offer.sellerId()),
                expectedStatus,
                Criteria.where("version")
                        .is(listing.getVersion())
        );

        Update update = new Update()
                .set("status", ListingStatus.SOLD);

        if (listing.getVersion() == null) {
            update.set("version", 1L);
        } else {
            update.inc("version", 1L);
        }

        long modified = mongo.updateFirst(
                Query.query(expected),
                update,
                Listing.class
        ).getModifiedCount();

        if (modified != 1) {
            throw new OptimisticLockingFailureException(
                    "Listing changed during confirmation."
            );
        }

        CompletedTransaction completed =
                new CompletedTransaction(
                        offer.id(),
                        offer.listingId(),
                        offer.buyerId(),
                        offer.sellerId(),
                        conversation.getId(),
                        pickup.getId(),
                        now
                );

        return mongo.insert(completed);
    }

    public CompletedTransaction getCompletedTransaction(
            String offerId,
            Authentication authentication
    ) {
        User user = currentUser(authentication);
        ObjectId id = parseId(offerId);

        OfferNegotiation offer = mongo.findById(
                id,
                OfferNegotiation.class
        );

        if (offer == null) {
            throw error(
                    HttpStatus.NOT_FOUND,
                    "Offer not found."
            );
        }

        boolean buyer = user.getId().equals(offer.buyerId());
        boolean seller = user.getId().equals(offer.sellerId());

        if (!buyer && !seller) {
            throw error(
                    HttpStatus.FORBIDDEN,
                    "You cannot view this transaction."
            );
        }

        CompletedTransaction completed = findByOffer(id);

        if (completed == null) {
            throw error(
                    HttpStatus.NOT_FOUND,
                    "Transaction has not been completed."
            );
        }

        return completed;
    }

    private CompletedTransaction findByOffer(ObjectId offerId) {
        return mongo.findOne(
                Query.query(
                        Criteria.where("offerId").is(offerId)
                ),
                CompletedTransaction.class
        );
    }

    public CompletedTransaction submitReview(
            String offerId, Authentication authentication, int rating, String comment
    ) {
        CompletedTransaction transaction = getCompletedTransaction(offerId, authentication);
        if (!transaction.getBuyerId().equals(currentUser(authentication).getId())) {
            throw error(HttpStatus.FORBIDDEN, "Only the buyer can review the seller.");
        }

        String reviewText = comment == null ? "" : comment.strip();
        var review = new CompletedTransaction.SellerReview(rating, reviewText, Instant.now());
        Query query = Query.query(Criteria.where("_id").is(transaction.getId()).and("sellerReview").isNull());
        CompletedTransaction updated = mongo.findAndModify(query, new Update().set("sellerReview", review),
                FindAndModifyOptions.options().returnNew(true), CompletedTransaction.class);
        if (updated != null) return updated;

        CompletedTransaction existing = findByOffer(transaction.getOfferId());
        var saved = existing == null ? null : existing.getSellerReview();
        if (saved != null && saved.rating() == rating && saved.comment().equals(reviewText)) return existing;
        throw error(HttpStatus.CONFLICT, "A review has already been submitted for this exchange.");
    }

    public List<CompletedTransaction.SellerReview> getSellerReviews(String offerId, Authentication authentication) {
        CompletedTransaction transaction = getCompletedTransaction(offerId, authentication);
        Query query = Query.query(Criteria.where("sellerId").is(transaction.getSellerId())
                .and("sellerReview").ne(null))
                .with(Sort.by(Sort.Order.desc("sellerReview.submittedAt"), Sort.Order.desc("_id")))
                .limit(50);
        return mongo.find(query, CompletedTransaction.class).stream()
                .map(CompletedTransaction::getSellerReview).toList();
    }

    private User currentUser(Authentication authentication) {
        if (authentication == null
                || !authentication.isAuthenticated()) {
            throw error(
                    HttpStatus.UNAUTHORIZED,
                    "Authentication required."
            );
        }

        return users.findByEmail(authentication.getName())
                .orElseThrow(() -> error(
                        HttpStatus.UNAUTHORIZED,
                        "User not found."
                ));
    }

    private ObjectId parseId(String value) {
        if (value == null || !ObjectId.isValid(value)) {
            throw error(
                    HttpStatus.BAD_REQUEST,
                    "Invalid offer ID."
            );
        }

        return new ObjectId(value);
    }

    private boolean retryable(Throwable failure) {
        if (failure instanceof OptimisticLockingFailureException) {
            return true;
        }

        for (Throwable cause = failure;
             cause != null;
             cause = cause.getCause()) {

            if (cause instanceof MongoException mongoFailure) {
                if (mongoFailure.hasErrorLabel(
                        "TransientTransactionError"
                ) || mongoFailure.hasErrorLabel(
                        "UnknownTransactionCommitResult"
                ) || mongoFailure.getCode() == 112) {
                    return true;
                }
            }
        }

        return false;
    }

    private ResponseStatusException error(
            HttpStatus status,
            String message
    ) {
        return new ResponseStatusException(status, message);
    }
}
