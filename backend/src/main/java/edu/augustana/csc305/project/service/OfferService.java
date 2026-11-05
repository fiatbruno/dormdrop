package edu.augustana.csc305.project.service;

import com.mongodb.MongoException;
import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.model.Conversation;
import edu.augustana.csc305.project.model.ListingStatus;
import edu.augustana.csc305.project.model.ModerationTypes.Visibility;
import edu.augustana.csc305.project.model.OfferNegotiation;
import edu.augustana.csc305.project.model.OfferCounterRequest;
import edu.augustana.csc305.project.model.OfferDecisionRequest;
import edu.augustana.csc305.project.model.OfferSubmissionRequest;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.UserRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
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
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.TransactionException;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.web.server.ResponseStatusException;

/** Authenticated offer commands and participant-only queries. */
@Service
public class OfferService {
    private final MongoTemplate mongo;
    private final UserRepository users;
    private final TransactionOperations transactions;
    private final OfferReceivedEventAppender notifications;
    private final OfferTransitionEventAppender transitions;

    public OfferService(MongoTemplate mongo, UserRepository users,
                        @Qualifier("reportTransactions") TransactionOperations transactions,
                        OfferTransitionEventAppender transitions) {
        this.mongo = mongo;
        this.users = users;
        this.transactions = transactions;
        this.notifications = new OfferReceivedEventAppender(mongo);
        this.transitions = transitions;
    }

    public record Submission(OfferNegotiation offer, boolean created) { }
    public record Page(List<OfferNegotiation> items, long total, int page, int size, long totalPages) { }

    public Submission submit(Authentication auth, String listingId, BigDecimal amount, String key) {
        User buyer = verified(auth);
        ObjectId listing = parseId(listingId);
        if (key == null || !key.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}"))
            throw badRequest("Idempotency-Key must contain 1 to 128 letters, digits, dots, colons, underscores or hyphens.");
        try { OfferNegotiation.validateAmount(amount); }
        catch (IllegalArgumentException failure) { throw badRequest("Amount must be positive and have at most two decimal places."); }
        // A key is scoped to the authenticated actor and this command, not a client-supplied identity.
        String requestId = buyer.getId().toHexString() + ":submit-offer:" + key;
        ObjectId offerId = new ObjectId();
        for (int attempt = 0; attempt < 12; attempt++) {
            try {
                return Objects.requireNonNull(transactions.execute(status -> {
                    User current = verified(auth);
                    if (!current.getId().equals(buyer.getId()))
                        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User changed. Please sign in again.");
                    return submitTransaction(current, listing, amount, requestId, offerId);
                }));
            } catch (DataAccessException | TransactionException failure) {
                if (!retryable(failure)) throw unavailable(failure);
                LockSupport.parkNanos(ThreadLocalRandom.current().nextLong(5, 51) * 1_000_000L);
            }
        }
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Offer could not be confirmed. Retry with the same Idempotency-Key.");
    }

    private Submission submitTransaction(User buyer, ObjectId listingId, BigDecimal amount,
                                          String requestId, ObjectId offerId) {
        OfferSubmissionRequest previous = mongo.findById(requestId, OfferSubmissionRequest.class);
        if (previous != null) {
            if (!listingId.equals(previous.listingId()) || previous.amount().compareTo(amount) != 0)
                throw conflict("This Idempotency-Key was already used for a different offer.");
            return new Submission(previous.result(), false);
        }
        Listing listing = mongo.findById(listingId, Listing.class);
        if (listing == null || listing.getModerationVisibility() != Visibility.VISIBLE)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found.");
        if (listing.getOwnerId() == null)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found.");
        if (buyer.getId().equals(listing.getOwnerId()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot offer on your own listing.");
        if (listing.getStatus() != ListingStatus.AVAILABLE || !"For sale".equalsIgnoreCase(listing.getListingType())
                || listing.getPrice() == null || listing.getPrice().signum() <= 0)
            throw conflict("Listing is not an available sale.");
        if (mongo.exists(Query.query(Criteria.where("buyerId").is(buyer.getId()).and("listingId").is(listingId)
                .and("status").is(OfferNegotiation.Status.ACCEPTED)), OfferNegotiation.class))
            throw conflict("You already have an accepted offer for this listing.");
        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        // Free the unique pending-offer slot when the previous response window has ended.
        mongo.updateMulti(Query.query(Criteria.where("buyerId").is(buyer.getId()).and("listingId").is(listingId)
                .and("status").is(OfferNegotiation.Status.PENDING)
                .and("updatedAt").lte(now.minus(14, ChronoUnit.DAYS))),
                new Update().set("status", OfferNegotiation.Status.EXPIRED).inc("version", 1L), OfferNegotiation.class);
        if (mongo.exists(Query.query(Criteria.where("buyerId").is(buyer.getId()).and("listingId").is(listingId)
                .and("status").is(OfferNegotiation.Status.PENDING)), OfferNegotiation.class))
            throw conflict("A pending offer already exists for this listing.");

        OfferNegotiation offer = OfferNegotiation.create(offerId, listingId, buyer.getId(), listing.getOwnerId(), amount, now);
        mongo.insert(offer);
        // Fence concurrent seller edits, deletion and visibility/status changes without changing listing lifecycle.
        Criteria visible = new Criteria().orOperator(Criteria.where("moderationVisibility").is(Visibility.VISIBLE),
                Criteria.where("moderationVisibility").is(null));
        Criteria available = new Criteria().orOperator(Criteria.where("status").is(ListingStatus.AVAILABLE),
                Criteria.where("status").exists(false));
        Query versionedListing = Query.query(new Criteria().andOperator(Criteria.where("_id").is(listingId),
                Criteria.where("version").is(listing.getVersion()), available,
                Criteria.where("ownerId").is(listing.getOwnerId()), visible));
        Update fence = listing.getVersion() == null ? new Update().set("version", 1L) : new Update().inc("version", 1L);
        if (mongo.updateFirst(versionedListing, fence, Listing.class).getModifiedCount() != 1)
            throw new OptimisticLockingFailureException("Listing changed while submitting offer.");
        Query conversationQuery = Query.query(Criteria.where("listingId").is(listingId).and("buyerId").is(buyer.getId()));
        Conversation conversation = mongo.findOne(conversationQuery, Conversation.class);
        if (conversation == null) {
            mongo.insert(new Conversation(listingId, buyer.getId(), listing.getOwnerId()));
        } else if (!listing.getOwnerId().equals(conversation.getSellerId())) {
            throw conflict("The existing conversation has a different seller.");
        }
        notifications.append(new OfferReceivedEventAppender.Submission(offer.id(), offer.listingId(),
                offer.buyerId(), offer.sellerId(), buyer.getName(), offer.amount(), now));
        mongo.insert(new OfferSubmissionRequest(requestId, listingId, amount, offer, now));
        return new Submission(offer, true);
    }

    /** Accept or reject the current proposal, returning the original result on an exact retry. */
    public OfferNegotiation decide(Authentication auth, String offerId, String action, Long expectedVersion, String key) {
        User actor = verified(auth);
        ObjectId target = parseId(offerId);
        if (key == null || !key.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}"))
            throw badRequest("Idempotency-Key must contain 1 to 128 letters, digits, dots, colons, underscores or hyphens.");
        if (expectedVersion == null || expectedVersion < 0) throw badRequest("A nonnegative expectedVersion is required.");
        OfferNegotiation.Status decision;
        if ("ACCEPT".equals(action)) decision = OfferNegotiation.Status.ACCEPTED;
        else if ("REJECT".equals(action)) decision = OfferNegotiation.Status.REJECTED;
        else throw badRequest("Action must be ACCEPT or REJECT.");
        String requestId = actor.getId().toHexString() + ":decide-offer:" + key;
        for (int attempt = 0; attempt < 12; attempt++) {
            try {
                return Objects.requireNonNull(transactions.execute(status -> {
                    User current = verified(auth);
                    if (!current.getId().equals(actor.getId()))
                        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User changed. Please sign in again.");
                    return decideTransaction(current, target, decision, expectedVersion, requestId);
                }));
            } catch (DataAccessException | TransactionException failure) {
                if (!retryable(failure)) throw unavailable(failure);
                LockSupport.parkNanos(ThreadLocalRandom.current().nextLong(5, 51) * 1_000_000L);
            }
        }
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Offer decision could not be confirmed. Retry with the same Idempotency-Key.");
    }

    private OfferNegotiation decideTransaction(User actor, ObjectId offerId, OfferNegotiation.Status decision,
                                                long expectedVersion, String requestId) {
        OfferDecisionRequest previous = mongo.findById(requestId, OfferDecisionRequest.class);
        if (previous != null) {
            if (!offerId.equals(previous.offerId()) || decision != previous.decision()
                    || expectedVersion != previous.expectedVersion())
                throw conflict("This Idempotency-Key was already used for a different decision.");
            return previous.result();
        }
        OfferNegotiation offer = mongo.findById(offerId, OfferNegotiation.class);
        if (offer == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Offer not found.");
        ObjectId actorId = actor.getId();
        if (!actorId.equals(offer.buyerId()) && !actorId.equals(offer.sellerId()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only participants may respond.");
        if (offer.version() != expectedVersion || offer.status() != OfferNegotiation.Status.PENDING
                || offer.version() == Long.MAX_VALUE)
            throw conflict("Offer changed or has already ended. Refresh and try again.");
        if (actorId.equals(offer.currentProposerId()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the other participant may respond.");

        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        if (offer.isExpired(now)) throw conflict("This offer has expired. Please make a new offer.");
        OfferNegotiation result = offer.decide(actorId, decision, expectedVersion, now);
        if (decision == OfferNegotiation.Status.ACCEPTED) fenceAvailableListing(offer, false);
        Query expected = Query.query(Criteria.where("_id").is(offerId).and("version").is(expectedVersion)
                .and("status").is(OfferNegotiation.Status.PENDING).and("currentProposerId").is(offer.currentProposerId()));
        Update update = new Update().set("status", decision).set("updatedAt", now).inc("version", 1L)
                .push("history", result.history().get(result.history().size() - 1));
        var commandWrite = mongo.updateFirst(expected, update, OfferNegotiation.class);
        if (commandWrite.getModifiedCount() != 1)
            throw conflict("Offer changed or has already ended. Refresh and try again.");
        transitions.append(new OfferTransitionEventAppender.Transition(offer.id(), offer.listingId(),
                offer.buyerId(), offer.sellerId(), actorId, offer.currentProposerId(),
                decision == OfferNegotiation.Status.ACCEPTED ? OfferTransitionEventAppender.Action.ACCEPT
                        : OfferTransitionEventAppender.Action.REJECT,
                result.amount(), expectedVersion, result.version(), now), commandWrite);
        mongo.insert(new OfferDecisionRequest(requestId, offerId, decision, expectedVersion, result, now));
        return result;
    }

    /** Counter the other participant's proposal; exact retries return the original response. */
    public OfferNegotiation counter(Authentication auth, String offerId, BigDecimal amount, Long expectedVersion, String key) {
        User actor = verified(auth);
        ObjectId target = parseId(offerId);
        if (key == null || !key.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}"))
            throw badRequest("Idempotency-Key must contain 1 to 128 letters, digits, dots, colons, underscores or hyphens.");
        if (expectedVersion == null || expectedVersion < 0) throw badRequest("A nonnegative expectedVersion is required.");
        try { OfferNegotiation.validateAmount(amount); }
        catch (IllegalArgumentException failure) { throw badRequest("Amount must be positive and have at most two decimal places."); }
        String requestId = actor.getId().toHexString() + ":counter-offer:" + key;
        for (int attempt = 0; attempt < 12; attempt++) {
            try {
                return Objects.requireNonNull(transactions.execute(status -> {
                    User current = verified(auth);
                    if (!current.getId().equals(actor.getId()))
                        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User changed. Please sign in again.");
                    return counterTransaction(current, target, amount, expectedVersion, requestId);
                }));
            } catch (DataAccessException | TransactionException failure) {
                if (!retryable(failure)) throw unavailable(failure);
                LockSupport.parkNanos(ThreadLocalRandom.current().nextLong(5, 51) * 1_000_000L);
            }
        }
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Counteroffer could not be confirmed. Retry with the same Idempotency-Key.");
    }

    private OfferNegotiation counterTransaction(User actor, ObjectId offerId, BigDecimal amount,
                                                 long expectedVersion, String requestId) {
        OfferCounterRequest previous = mongo.findById(requestId, OfferCounterRequest.class);
        if (previous != null) {
            if (!offerId.equals(previous.offerId()) || previous.amount().compareTo(amount) != 0
                    || expectedVersion != previous.expectedVersion())
                throw conflict("This Idempotency-Key was already used for a different counteroffer.");
            return previous.result();
        }
        OfferNegotiation offer = mongo.findById(offerId, OfferNegotiation.class);
        if (offer == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Offer not found.");
        ObjectId actorId = actor.getId();
        if (!actorId.equals(offer.buyerId()) && !actorId.equals(offer.sellerId()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only participants may respond.");
        if (offer.version() != expectedVersion || offer.status() != OfferNegotiation.Status.PENDING
                || offer.version() == Long.MAX_VALUE)
            throw conflict("Offer changed or has already ended. Refresh and try again.");
        if (actorId.equals(offer.currentProposerId()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the other participant may respond.");

        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        if (offer.isExpired(now)) throw conflict("This offer has expired. Please make a new offer.");
        OfferNegotiation result = offer.counter(actorId, amount, expectedVersion, now);
        fenceAvailableListing(offer, true);
        Query expected = Query.query(Criteria.where("_id").is(offerId).and("version").is(expectedVersion)
                .and("status").is(OfferNegotiation.Status.PENDING).and("currentProposerId").is(offer.currentProposerId()));
        Update update = new Update().set("amount", amount).set("currentProposerId", actorId)
                .set("updatedAt", now).inc("version", 1L)
                .push("history", result.history().get(result.history().size() - 1));
        var commandWrite = mongo.updateFirst(expected, update, OfferNegotiation.class);
        if (commandWrite.getModifiedCount() != 1)
            throw conflict("Offer changed or has already ended. Refresh and try again.");
        transitions.append(new OfferTransitionEventAppender.Transition(offer.id(), offer.listingId(),
                offer.buyerId(), offer.sellerId(), actorId, offer.currentProposerId(),
                OfferTransitionEventAppender.Action.COUNTER, result.amount(), expectedVersion,
                result.version(), now), commandWrite);
        mongo.insert(new OfferCounterRequest(requestId, offerId, amount, expectedVersion, result, now));
        return result;
    }

    /** Ensure a concurrent listing change cannot slip between the availability check and commit. */
    private void fenceAvailableListing(OfferNegotiation offer, boolean requireSale) {
        Listing listing = mongo.findById(offer.listingId(), Listing.class);
        if (listing == null || listing.getStatus() != ListingStatus.AVAILABLE
                || listing.getModerationVisibility() != Visibility.VISIBLE
                || !offer.sellerId().equals(listing.getOwnerId())
                || (requireSale && (!"For sale".equalsIgnoreCase(listing.getListingType())
                    || listing.getPrice() == null || listing.getPrice().signum() <= 0)))
            throw conflict("Listing is not available for this offer action.");
        Criteria visible = new Criteria().orOperator(Criteria.where("moderationVisibility").is(Visibility.VISIBLE),
                Criteria.where("moderationVisibility").is(null));
        Criteria available = new Criteria().orOperator(Criteria.where("status").is(ListingStatus.AVAILABLE),
                Criteria.where("status").exists(false));
        Query fence = Query.query(new Criteria().andOperator(Criteria.where("_id").is(offer.listingId()),
                Criteria.where("version").is(listing.getVersion()), Criteria.where("ownerId").is(offer.sellerId()),
                visible, available));
        Update update = listing.getVersion() == null ? new Update().set("version", 1L) : new Update().inc("version", 1L);
        if (mongo.updateFirst(fence, update, Listing.class).getModifiedCount() != 1)
            throw new OptimisticLockingFailureException("Listing changed while deciding offer.");
    }

    public OfferNegotiation get(Authentication auth, String offerId) {
        User user = verified(auth);
        OfferNegotiation offer = mongo.findById(parseId(offerId), OfferNegotiation.class);
        if (offer == null || (!user.getId().equals(offer.buyerId()) && !user.getId().equals(offer.sellerId())))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Offer not found.");
        return offer;
    }

    /** The buyer's own current offer, prioritizing an agreement over older negotiations. */
    public OfferNegotiation getBuyerListingOffer(Authentication auth, String listingId) {
        User buyer = verified(auth);
        ObjectId target = parseId(listingId);
        Criteria accepted = Criteria.where("buyerId").is(buyer.getId()).and("listingId").is(target)
                .and("status").is(OfferNegotiation.Status.ACCEPTED);
        Sort newest = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("_id"));
        OfferNegotiation agreement = mongo.findOne(Query.query(accepted).with(newest), OfferNegotiation.class);
        if (agreement != null) return agreement;
        return mongo.findOne(Query.query(Criteria.where("buyerId").is(buyer.getId()).and("listingId").is(target))
                .with(newest), OfferNegotiation.class);
    }

    public Page list(Authentication auth, String perspective, int page, int size) {
        User user = verified(auth);
        if (page < 0 || size < 1 || size > 100) throw badRequest("Page must be nonnegative and size between 1 and 100.");
        String field;
        if ("buyer".equals(perspective)) field = "buyerId";
        else if ("seller".equals(perspective)) field = "sellerId";
        else throw badRequest("Perspective must be buyer or seller.");
        Criteria owner = Criteria.where(field).is(user.getId());
        long total = mongo.count(Query.query(owner), OfferNegotiation.class);
        List<OfferNegotiation> items = mongo.find(Query.query(owner)
                .with(Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("_id")))
                .skip((long) page * size).limit(size), OfferNegotiation.class);
        return new Page(List.copyOf(items), total, page, size, total == 0 ? 0 : (total - 1) / size + 1);
    }

    private User verified(Authentication auth) {
        if (auth == null || !auth.isAuthenticated())
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required.");
        User user = users.findByEmail(auth.getName()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found."));
        if (user.getId() == null || !user.isEmailVerified() || user.getEmail() == null
                || !user.getEmail().trim().toLowerCase(Locale.ROOT).endsWith("@augustana.edu"))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Verified campus email required.");
        return user;
    }

    private ObjectId parseId(String value) {
        if (value == null || !ObjectId.isValid(value)) throw badRequest("Invalid ID.");
        return new ObjectId(value);
    }
    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
    private static ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }
    private static ResponseStatusException unavailable(Throwable cause) {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Offer could not be confirmed. Retry with the same Idempotency-Key.", cause);
    }
    private static boolean retryable(Throwable failure) {
        if (failure instanceof DuplicateKeyException || failure instanceof OptimisticLockingFailureException) return true;
        for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
            if (cause instanceof MongoException mongoFailure && (mongoFailure.hasErrorLabel("TransientTransactionError")
                    || mongoFailure.hasErrorLabel("UnknownTransactionCommitResult") || mongoFailure.getCode() == 112)) return true;
        }
        return false;
    }
}
