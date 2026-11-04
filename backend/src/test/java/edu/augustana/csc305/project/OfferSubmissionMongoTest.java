package edu.augustana.csc305.project;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import edu.augustana.csc305.project.config.OfferSchema;
import edu.augustana.csc305.project.config.ReportTransactionConfig;
import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.model.Conversation;
import edu.augustana.csc305.project.model.ListingStatus;
import edu.augustana.csc305.project.model.OfferNegotiation;
import edu.augustana.csc305.project.model.OfferDecisionRequest;
import edu.augustana.csc305.project.model.OfferCounterRequest;
import edu.augustana.csc305.project.model.ModerationTypes.Visibility;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.UserRepository;
import edu.augustana.csc305.project.service.OfferService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

/** Uses a disposable database on a transaction-capable MongoDB test server. */
@EnabledIfEnvironmentVariable(named = "MODERATION_TEST_MONGODB_URI", matches = ".+")
class OfferSubmissionMongoTest {
    private MongoClient client;
    private MongoTemplate mongo;
    private UserRepository users;
    private OfferService offers;
    private User buyer;
    private User seller;
    private User outsider;
    private Listing listing;

    @BeforeEach void setup() {
        client = MongoClients.create(System.getenv("MODERATION_TEST_MONGODB_URI"));
        mongo = new MongoTemplate(client, "offers_test_" + new ObjectId().toHexString());
        OfferSchema.initialize(mongo);
        users = new UserRepository(mongo);
        offers = new OfferService(mongo, users,
                new ReportTransactionConfig().reportTransactions(mongo.getMongoDatabaseFactory()));
        buyer = user(true, "augustana.edu");
        seller = user(true, "augustana.edu");
        outsider = user(true, "augustana.edu");
        listing = listing(seller);
    }

    @AfterEach void cleanup() {
        if (mongo != null) mongo.getDb().drop();
        if (client != null) client.close();
    }

    private User user(boolean verified, String domain) {
        ObjectId id = new ObjectId();
        User user = new User(id, "Test", id.toHexString() + "@" + domain, "password-hash");
        user.setEmailVerified(verified);
        users.storeUser(user);
        return user;
    }

    private Listing listing(User owner) {
        Listing value = new Listing();
        value.setId(new ObjectId());
        value.setOwnerId(owner.getId());
        value.setTitle("Desk");
        value.setListingType("For sale");
        value.setPrice(new BigDecimal("50.00"));
        return mongo.insert(value);
    }

    private UsernamePasswordAuthenticationToken auth(User user) {
        return new UsernamePasswordAuthenticationToken(user.getEmail(), null, List.of());
    }

    private static String id(ObjectId id) { return id.toHexString(); }

    private static void status(int status, org.junit.jupiter.api.function.Executable action) {
        assertEquals(status, assertThrows(ResponseStatusException.class, action).getStatusCode().value());
    }

    @Test void buyerAndSellerCanReadButOthersCannotAndSameKeyReplays() {
        var original = offers.submit(auth(buyer), id(listing.getId()), new BigDecimal("19.99"), "submit-1");
        assertTrue(original.created());
        assertEquals(buyer.getId(), original.offer().buyerId());
        assertEquals(seller.getId(), original.offer().sellerId());
        assertEquals(OfferNegotiation.Status.PENDING, original.offer().status());
        var replay = offers.submit(auth(buyer), id(listing.getId()), new BigDecimal("19.99"), "submit-1");
        assertFalse(replay.created());
        assertEquals(original.offer().id(), replay.offer().id());
        assertEquals(original.offer().id(), offers.get(auth(buyer), id(original.offer().id())).id());
        assertEquals(original.offer().id(), offers.get(auth(seller), id(original.offer().id())).id());
        status(404, () -> offers.get(auth(outsider), id(original.offer().id())));
        status(409, () -> offers.submit(auth(buyer), id(listing.getId()), new BigDecimal("20.00"), "submit-1"));
        status(409, () -> offers.submit(auth(buyer), id(listing.getId()), new BigDecimal("19.99"), "other-key"));
        assertEquals(1, mongo.count(new Query(), OfferNegotiation.class));
        assertEquals(1, mongo.count(new Query(), Conversation.class));
        var conversation = mongo.findAll(Conversation.class).get(0);
        assertEquals(listing.getId(), conversation.getListingId());
        assertEquals(buyer.getId(), conversation.getBuyerId());
        assertEquals(seller.getId(), conversation.getSellerId());
    }

    @Test void reusesExistingConversationAndAllowsNewOfferAfterExpiry() {
        Conversation existing = mongo.insert(new Conversation(listing.getId(), buyer.getId(), seller.getId()));
        var old = OfferNegotiation.create(listing.getId(), buyer.getId(), seller.getId(), BigDecimal.TEN,
                Instant.now().minusSeconds(15L * 24 * 60 * 60));
        mongo.insert(old);
        status(409, () -> offers.decide(auth(seller), id(old.id()), "ACCEPT", 0L, "expired"));
        status(409, () -> offers.counter(auth(seller), id(old.id()), BigDecimal.ONE, 0L, "expired-counter"));
        var replacement = offers.submit(auth(buyer), id(listing.getId()), BigDecimal.ONE, "new-offer");
        assertTrue(replacement.created());
        assertEquals(OfferNegotiation.Status.EXPIRED, mongo.findById(old.id(), OfferNegotiation.class).status());
        assertEquals(1, mongo.count(new Query(), Conversation.class));
        assertEquals(existing.getId(), mongo.findAll(Conversation.class).get(0).getId());
    }

    @Test void rejectsIneligibleAccountsListingsAndInvalidRequestsWithoutCreatingAnOffer() {
        User unverified = user(false, "augustana.edu");
        User external = user(true, "example.com");
        status(401, () -> offers.submit(null, id(listing.getId()), BigDecimal.ONE, "key"));
        status(403, () -> offers.submit(auth(unverified), id(listing.getId()), BigDecimal.ONE, "key"));
        status(403, () -> offers.submit(auth(external), id(listing.getId()), BigDecimal.ONE, "key"));
        status(403, () -> offers.submit(auth(seller), id(listing.getId()), BigDecimal.ONE, "key"));
        status(400, () -> offers.submit(auth(buyer), "bad-id", BigDecimal.ONE, "key"));
        status(400, () -> offers.submit(auth(buyer), id(listing.getId()), BigDecimal.ZERO, "key"));
        status(400, () -> offers.submit(auth(buyer), id(listing.getId()), new BigDecimal("1.001"), "key"));
        status(400, () -> offers.submit(auth(buyer), id(listing.getId()), BigDecimal.ONE, "bad key"));
        status(404, () -> offers.submit(auth(buyer), id(new ObjectId()), BigDecimal.ONE, "key"));
        Listing free = listing(seller);
        free.setListingType("Free");
        free.setPrice(BigDecimal.ZERO);
        mongo.save(free);
        status(409, () -> offers.submit(auth(buyer), id(free.getId()), BigDecimal.ONE, "key"));
        Listing unavailable = listing(seller);
        unavailable.setStatus(ListingStatus.SOLD);
        mongo.save(unavailable);
        status(409, () -> offers.submit(auth(buyer), id(unavailable.getId()), BigDecimal.ONE, "key"));
        assertEquals(0, mongo.count(new Query(), OfferNegotiation.class));
    }

    @Test void auditLedgerFailureRollsBackOfferAndListingVersion() {
        Long originalVersion = listing.getVersion();
        mongo.getDb().createCollection("offerSubmissionRequests", new com.mongodb.client.model.CreateCollectionOptions()
                .validationOptions(new com.mongodb.client.model.ValidationOptions()
                        .validator(new org.bson.Document("impossible", new org.bson.Document("$exists", true)))));
        assertThrows(ResponseStatusException.class,
                () -> offers.submit(auth(buyer), id(listing.getId()), BigDecimal.ONE, "ledger-fails"));
        assertEquals(0, mongo.count(new Query(), OfferNegotiation.class));
        assertEquals(originalVersion, mongo.findById(listing.getId(), Listing.class).getVersion());
        assertEquals(0, mongo.getCollection("offerSubmissionRequests").countDocuments());
        assertEquals(0, mongo.count(new Query(), Conversation.class));
    }

    @Test void legacyListingWithMissingVersionStatusAndVisibilityCanReceiveAnOffer() {
        mongo.getCollection("listings").updateOne(new org.bson.Document("_id", listing.getId()),
                new org.bson.Document("$unset", new org.bson.Document("version", "")
                        .append("status", "").append("moderationVisibility", "")));
        var submitted = offers.submit(auth(buyer), id(listing.getId()), BigDecimal.ONE, "legacy-listing");
        assertTrue(submitted.created());
        assertEquals(ListingStatus.AVAILABLE, mongo.findById(listing.getId(), Listing.class).getStatus());
    }

    private List<Object> concurrently(List<Callable<Object>> actions) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(actions.size());
        CountDownLatch ready = new CountDownLatch(actions.size());
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<Object>> futures = new ArrayList<>();
            for (var action : actions) futures.add(pool.submit(() -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Timed out");
                try { return action.call(); }
                catch (ResponseStatusException failure) { return failure; }
            }));
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            List<Object> result = new ArrayList<>();
            for (var future : futures) result.add(future.get(60, TimeUnit.SECONDS));
            return result;
        } finally {
            start.countDown();
            pool.shutdownNow();
            assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS));
        }
    }

    @Test void sellerDecisionIsReplayableAndDoesNotChangeOtherOffersOrListingStatus() {
        var first = offers.submit(auth(buyer), id(listing.getId()), new BigDecimal("19.99"), "first").offer();
        var other = offers.submit(auth(outsider), id(listing.getId()), new BigDecimal("25.00"), "other").offer();
        var accepted = offers.decide(auth(seller), id(first.id()), "ACCEPT", 0L, "decision");
        assertEquals(OfferNegotiation.Status.ACCEPTED, accepted.status());
        assertEquals(1, accepted.version());
        assertEquals(accepted, offers.decide(auth(seller), id(first.id()), "ACCEPT", 0L, "decision"));
        status(409, () -> offers.decide(auth(seller), id(first.id()), "REJECT", 0L, "decision"));
        status(409, () -> offers.decide(auth(seller), id(first.id()), "ACCEPT", 0L, "new-key"));
        var persisted = mongo.findById(first.id(), OfferNegotiation.class);
        assertEquals(2, persisted.history().size());
        assertEquals(OfferNegotiation.Action.ACCEPTED, persisted.history().get(1).action());
        assertEquals(OfferNegotiation.Status.PENDING, mongo.findById(other.id(), OfferNegotiation.class).status());
        assertEquals(ListingStatus.AVAILABLE, mongo.findById(listing.getId(), Listing.class).getStatus());
        assertEquals(1, mongo.count(new Query(), OfferDecisionRequest.class));
    }

    @Test void rejectionIsAllowedWhenListingIsGoneButAcceptanceIsNot() {
        var first = offers.submit(auth(buyer), id(listing.getId()), BigDecimal.ONE, "first").offer();
        var second = offers.submit(auth(outsider), id(listing.getId()), BigDecimal.TEN, "second").offer();
        mongo.remove(listing);
        status(409, () -> offers.decide(auth(seller), id(first.id()), "ACCEPT", 0L, "accept"));
        assertEquals(OfferNegotiation.Status.REJECTED,
                offers.decide(auth(seller), id(second.id()), "REJECT", 0L, "reject").status());
        assertEquals(OfferNegotiation.Status.PENDING, mongo.findById(first.id(), OfferNegotiation.class).status());
    }

    @Test void hiddenOrSoldListingCannotBeAcceptedAndBuyerCanAnswerSellerCounter() {
        var first = offers.submit(auth(buyer), id(listing.getId()), BigDecimal.ONE, "first").offer();
        Listing current = mongo.findById(listing.getId(), Listing.class);
        current.setModerationVisibility(Visibility.HIDDEN);
        mongo.save(current);
        status(409, () -> offers.decide(auth(seller), id(first.id()), "ACCEPT", 0L, "hidden"));
        current = mongo.findById(listing.getId(), Listing.class);
        current.setModerationVisibility(Visibility.VISIBLE);
        current.setStatus(ListingStatus.SOLD);
        mongo.save(current);
        status(409, () -> offers.decide(auth(seller), id(first.id()), "ACCEPT", 0L, "sold"));
        var counter = first.counter(seller.getId(), new BigDecimal("2.00"), 0L, Instant.now());
        mongo.save(counter);
        status(403, () -> offers.decide(auth(seller), id(first.id()), "REJECT", 1L, "self"));
        assertEquals(OfferNegotiation.Status.REJECTED,
                offers.decide(auth(buyer), id(first.id()), "REJECT", 1L, "buyer").status());
    }

    @Test void simultaneousDecisionsHaveOneWinnerAndStaleConflict() throws Exception {
        var offer = offers.submit(auth(buyer), id(listing.getId()), BigDecimal.ONE, "submit").offer();
        var results = concurrently(List.of(
                () -> offers.decide(auth(seller), id(offer.id()), "ACCEPT", 0L, "accept"),
                () -> offers.decide(auth(seller), id(offer.id()), "REJECT", 0L, "reject")));
        assertEquals(1, results.stream().filter(OfferNegotiation.class::isInstance).count(), results.toString());
        var failure = results.stream().filter(ResponseStatusException.class::isInstance)
                .map(ResponseStatusException.class::cast).findFirst().orElseThrow();
        assertEquals(409, failure.getStatusCode().value());
        assertEquals(2, mongo.findById(offer.id(), OfferNegotiation.class).history().size());
        assertEquals(1, mongo.count(new Query(), OfferDecisionRequest.class));
    }

    @Test void simultaneousIdenticalDecisionRetriesReturnTheSameResult() throws Exception {
        var offer = offers.submit(auth(buyer), id(listing.getId()), BigDecimal.ONE, "submit").offer();
        Callable<Object> decide = () -> offers.decide(auth(seller), id(offer.id()), "REJECT", 0L, "same");
        var results = concurrently(List.of(decide, decide));
        assertTrue(results.stream().allMatch(OfferNegotiation.class::isInstance), results.toString());
        assertEquals(results.get(0), results.get(1));
        assertEquals(2, mongo.findById(offer.id(), OfferNegotiation.class).history().size());
        assertEquals(1, mongo.count(new Query(), OfferDecisionRequest.class));
    }

    @Test void counterofferChainKeepsHistoryAndAcceptsTheLatestPrice() {
        var original = offers.submit(auth(buyer), id(listing.getId()), new BigDecimal("20.00"), "submit").offer();
        var sellerCounter = offers.counter(auth(seller), id(original.id()), new BigDecimal("25.00"), 0L, "seller");
        assertEquals(seller.getId(), sellerCounter.currentProposerId());
        var buyerCounter = offers.counter(auth(buyer), id(original.id()), new BigDecimal("22.00"), 1L, "buyer");
        assertEquals(buyer.getId(), buyerCounter.currentProposerId());
        var accepted = offers.decide(auth(seller), id(original.id()), "ACCEPT", 2L, "accept");
        assertEquals(OfferNegotiation.Status.ACCEPTED, accepted.status());
        var saved = mongo.findById(original.id(), OfferNegotiation.class);
        assertEquals(0, new BigDecimal("22.00").compareTo(saved.amount()));
        assertEquals(List.of(OfferNegotiation.Action.PROPOSED, OfferNegotiation.Action.COUNTERED,
                        OfferNegotiation.Action.COUNTERED, OfferNegotiation.Action.ACCEPTED),
                saved.history().stream().map(OfferNegotiation.HistoryEntry::action).toList());
        assertEquals(List.of("20", "25", "22", "22"), saved.history().stream()
                .map(entry -> entry.amount().stripTrailingZeros().toPlainString()).toList());
        assertEquals(ListingStatus.AVAILABLE, mongo.findById(listing.getId(), Listing.class).getStatus());
        assertEquals(sellerCounter, offers.counter(auth(seller), id(original.id()), new BigDecimal("25"), 0L, "seller"));
        status(409, () -> offers.counter(auth(seller), id(original.id()), new BigDecimal("26"), 0L, "seller"));
    }

    @Test void rejectingACounterEndsNegotiationAndFurtherCountersFail() {
        var original = offers.submit(auth(buyer), id(listing.getId()), BigDecimal.TEN, "submit").offer();
        offers.counter(auth(seller), id(original.id()), new BigDecimal("15"), 0L, "counter");
        var rejected = offers.decide(auth(buyer), id(original.id()), "REJECT", 1L, "reject");
        assertEquals(OfferNegotiation.Status.REJECTED, rejected.status());
        status(409, () -> offers.counter(auth(seller), id(original.id()), new BigDecimal("14"), 2L, "after"));
        assertEquals(3, mongo.findById(original.id(), OfferNegotiation.class).history().size());
    }

    @Test void simultaneousCounterAndAcceptHaveExactlyOneWinner() throws Exception {
        var original = offers.submit(auth(buyer), id(listing.getId()), BigDecimal.TEN, "submit").offer();
        var results = concurrently(List.of(
                () -> offers.counter(auth(seller), id(original.id()), new BigDecimal("15"), 0L, "counter"),
                () -> offers.decide(auth(seller), id(original.id()), "ACCEPT", 0L, "accept")));
        assertEquals(1, results.stream().filter(OfferNegotiation.class::isInstance).count(), results.toString());
        var failure = results.stream().filter(ResponseStatusException.class::isInstance)
                .map(ResponseStatusException.class::cast).findFirst().orElseThrow();
        assertEquals(409, failure.getStatusCode().value());
        assertEquals(2, mongo.findById(original.id(), OfferNegotiation.class).history().size());
        assertEquals(1, mongo.count(new Query(), OfferCounterRequest.class)
                + mongo.count(new Query(), OfferDecisionRequest.class));
    }

    @Test void simultaneousIdenticalCountersReplayOneSavedResult() throws Exception {
        var original = offers.submit(auth(buyer), id(listing.getId()), BigDecimal.TEN, "submit").offer();
        Callable<Object> counter = () -> offers.counter(auth(seller), id(original.id()), new BigDecimal("15"), 0L, "same");
        var results = concurrently(List.of(counter, counter));
        assertTrue(results.stream().allMatch(OfferNegotiation.class::isInstance), results.toString());
        assertEquals(results.get(0), results.get(1));
        assertEquals(2, mongo.findById(original.id(), OfferNegotiation.class).history().size());
        assertEquals(1, mongo.count(new Query(), OfferCounterRequest.class));
    }

    @Test void failedCounterLedgerRollsBackOfferAndListingFence() {
        var original = offers.submit(auth(buyer), id(listing.getId()), BigDecimal.TEN, "submit").offer();
        Long version = mongo.findById(listing.getId(), Listing.class).getVersion();
        mongo.getCollection("offerCounterRequests").drop();
        mongo.getDb().createCollection("offerCounterRequests", new com.mongodb.client.model.CreateCollectionOptions()
                .validationOptions(new com.mongodb.client.model.ValidationOptions()
                        .validator(new org.bson.Document("impossible", new org.bson.Document("$exists", true)))));
        assertThrows(ResponseStatusException.class,
                () -> offers.counter(auth(seller), id(original.id()), new BigDecimal("15"), 0L, "fail"));
        var saved = mongo.findById(original.id(), OfferNegotiation.class);
        assertEquals(0, saved.version());
        assertEquals(1, saved.history().size());
        assertEquals(version, mongo.findById(listing.getId(), Listing.class).getVersion());
    }

    @Test void decisionLedgerFailureRollsBackOfferAndListingFence() {
        var offer = offers.submit(auth(buyer), id(listing.getId()), BigDecimal.ONE, "submit").offer();
        Long version = mongo.findById(listing.getId(), Listing.class).getVersion();
        mongo.getCollection("offerDecisionRequests").drop();
        mongo.getDb().createCollection("offerDecisionRequests", new com.mongodb.client.model.CreateCollectionOptions()
                .validationOptions(new com.mongodb.client.model.ValidationOptions()
                        .validator(new org.bson.Document("impossible", new org.bson.Document("$exists", true)))));
        assertThrows(ResponseStatusException.class,
                () -> offers.decide(auth(seller), id(offer.id()), "ACCEPT", 0L, "fail"));
        assertEquals(OfferNegotiation.Status.PENDING, mongo.findById(offer.id(), OfferNegotiation.class).status());
        assertEquals(1, mongo.findById(offer.id(), OfferNegotiation.class).history().size());
        assertEquals(version, mongo.findById(listing.getId(), Listing.class).getVersion());
    }

    @Test void simultaneousSameKeySubmitsReturnOneOfferAndOneReplay() throws Exception {
        Callable<Object> submit = () -> offers.submit(auth(buyer), id(listing.getId()), new BigDecimal("19.99"), "same-key");
        var results = concurrently(List.of(submit, submit));
        assertTrue(results.stream().allMatch(OfferService.Submission.class::isInstance), results.toString());
        var first = (OfferService.Submission) results.get(0);
        var second = (OfferService.Submission) results.get(1);
        assertEquals(first.offer().id(), second.offer().id());
        assertNotEquals(first.created(), second.created());
        assertEquals(1, mongo.count(new Query(), OfferNegotiation.class));
    }

    @Test void simultaneousDifferentKeysCannotCreateDuplicatePendingOffers() throws Exception {
        var results = concurrently(List.of(
                () -> offers.submit(auth(buyer), id(listing.getId()), BigDecimal.ONE, "key-a"),
                () -> offers.submit(auth(buyer), id(listing.getId()), BigDecimal.ONE, "key-b")));
        assertEquals(1, results.stream().filter(OfferService.Submission.class::isInstance).count(), results.toString());
        var conflict = results.stream().filter(ResponseStatusException.class::isInstance)
                .map(ResponseStatusException.class::cast).findFirst().orElseThrow();
        assertEquals(409, conflict.getStatusCode().value());
        assertEquals(1, mongo.count(new Query(), OfferNegotiation.class));
    }

    @Test void listsOnlyTheRequestedPerspectiveWithStableIdTieBreakingAndBounds() {
        Instant sameTime = Instant.parse("2026-11-03T12:00:00Z");
        Listing otherListing = listing(seller);
        var first = OfferNegotiation.create(listing.getId(), buyer.getId(), seller.getId(), BigDecimal.ONE, sameTime);
        var second = OfferNegotiation.create(otherListing.getId(), buyer.getId(), seller.getId(), BigDecimal.TEN, sameTime);
        var irrelevant = OfferNegotiation.create(listing.getId(), outsider.getId(), seller.getId(), BigDecimal.ONE, sameTime);
        mongo.insert(first);
        mongo.insert(second);
        mongo.insert(irrelevant);
        var page0 = offers.list(auth(buyer), "buyer", 0, 1);
        var page1 = offers.list(auth(buyer), "buyer", 1, 1);
        assertEquals(2, page0.total());
        assertEquals(2, page0.totalPages());
        assertEquals(1, page0.items().size());
        assertEquals(1, page1.items().size());
        assertTrue(page0.items().get(0).id().compareTo(page1.items().get(0).id()) > 0);
        assertEquals(3, offers.list(auth(seller), "seller", 0, 20).total());
        assertEquals(0, offers.list(auth(outsider), "seller", 0, 20).total());
        status(400, () -> offers.list(auth(buyer), "everyone", 0, 20));
        status(400, () -> offers.list(auth(buyer), "buyer", -1, 20));
        status(400, () -> offers.list(auth(buyer), "buyer", 0, 101));
    }
}
