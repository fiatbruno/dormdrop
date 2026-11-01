package edu.augustana.csc305.project;

import com.mongodb.client.*;
import com.mongodb.client.result.UpdateResult;
import edu.augustana.csc305.project.config.PrivateNotificationConfiguration;
import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.UserRepository;
import edu.augustana.csc305.project.service.*;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;

import static edu.augustana.csc305.project.service.OfferTransitionEventAppender.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Command fixtures verify the #76 contract; real #66/#71 endpoint wiring is still required. */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@EnabledIfEnvironmentVariable(named = "NOTIFICATION_TEST_MONGODB_URI", matches = ".+")
class OfferTransitionNotificationMongoTest {
    private final String database = "ot_test_" + new ObjectId().toHexString();
    private final ObjectId buyerId = new ObjectId(), sellerId = new ObjectId(), offerId = new ObjectId(), listingId = new ObjectId();
    private final Instant now = Instant.parse("2026-11-01T18:00:00.123Z");
    private MongoClient client;
    private MongoTemplate mongo;
    private TransactionTemplate transactions;
    private OfferTransitionEventAppender appender;
    private PrivateNotificationService inbox;
    private PrivateNotificationWorker worker;

    @BeforeAll void open() {
        client = MongoClients.create(System.getenv("NOTIFICATION_TEST_MONGODB_URI"));
        mongo = new MongoTemplate(client, database);
        PrivateNotificationConfiguration.initialize(mongo);
        mongo.createCollection("offerCommandFixtures");
        transactions = new TransactionTemplate(new MongoTransactionManager(mongo.getMongoDatabaseFactory()));
        appender = new OfferTransitionEventAppender(mongo);
        var users = mock(UserRepository.class);
        when(users.findByEmail("buyer@example.edu")).thenReturn(Optional.of(new User(buyerId, "Buyer", "buyer@example.edu", "hash")));
        when(users.findByEmail("seller@example.edu")).thenReturn(Optional.of(new User(sellerId, "Seller", "seller@example.edu", "hash")));
        Clock clock = Clock.fixed(now, ZoneOffset.UTC);
        inbox = new PrivateNotificationService(mongo, users, clock);
        worker = new PrivateNotificationWorker(mongo, new NotificationLeaseQueue(mongo, clock, 1, 10), inbox, 50);
    }

    @BeforeEach void seed() {
        mongo.getCollection("offerCommandFixtures").insertOne(new Document("_id", offerId).append("version", 0L).append("initialPrice", "20.00"));
    }

    @AfterEach void clear() {
        for (String name : List.of("notifications", "notificationOutbox", "offerCommandFixtures"))
            mongo.getCollection(name).deleteMany(new Document());
    }

    @AfterAll void close() {
        try {
            if (client != null) {
                if (!database.matches("ot_test_[a-f0-9]{24}")) throw new IllegalStateException("Unsafe test database.");
                for (String name : List.of("notifications", "notificationOutbox", "offerCommandFixtures"))
                    client.getDatabase(database).getCollection(name).drop();
            }
        } finally { if (client != null) client.close(); }
    }

    private Transition transition(ObjectId actor, Action action, String price, long expected) {
        ObjectId proposer = actor.equals(buyerId) ? sellerId : buyerId;
        return new Transition(offerId, listingId, buyerId, sellerId, actor, proposer, action, new BigDecimal(price), expected, expected + 1, now);
    }

    private UpdateResult update(Transition transition) {
        return mongo.updateFirst(Query.query(Criteria.where("_id").is(offerId).and("version").is(transition.expectedVersion())),
                new Update().inc("version", 1L).set("lastAction", transition.action().name()), "offerCommandFixtures");
    }

    private NotificationOutboxEvent commit(Transition transition) {
        return transactions.execute(tx -> appender.append(transition, update(transition)));
    }

    private edu.augustana.csc305.project.dto.NotificationResponse.Page notices(String participant) {
        return inbox.list(new UsernamePasswordAuthenticationToken(participant + "@example.edu", null, List.of()), 0, 20);
    }

    @Test void initialSellerAcceptAndRejectEachNotifyOnlyBuyerWithCurrentPrice() {
        for (Action action : List.of(Action.ACCEPT, Action.REJECT)) {
            var source = commit(transition(sellerId, action, "25.50", 0));
            assertEquals(buyerId, source.recipientId());
            assertTrue(worker.processOne());
            var buyer = notices("buyer");
            assertEquals(1, buyer.total());
            assertEquals(0, notices("seller").total());
            var notice = buyer.items().get(0);
            assertEquals(action == Action.ACCEPT ? PrivateNotification.Type.OFFER_ACCEPTED : PrivateNotification.Type.OFFER_REJECTED, notice.type());
            assertEquals(action == Action.ACCEPT ? PrivateNotification.Status.ACCEPTED : PrivateNotification.Status.REJECTED, notice.payload().status());
            assertEquals(new BigDecimal("25.50"), notice.payload().price());
            assertEquals(offerId.toHexString(), notice.offerId());
            assertEquals(listingId.toHexString(), notice.listingId());
            mongo.getCollection("notifications").deleteMany(new Document());
            mongo.getCollection("notificationOutbox").deleteMany(new Document());
            mongo.getCollection("offerCommandFixtures").updateOne(new Document("_id", offerId), new Document("$set", new Document("version", 0L)));
        }
    }

    @Test void buyer20Seller25Buyer22SellerAcceptsNotifiesOnlyTheOtherParticipant() {
        var sellerCounter = commit(transition(sellerId, Action.COUNTER, "25", 0));
        assertEquals(buyerId, sellerCounter.recipientId());
        assertTrue(worker.processOne());
        assertEquals(1, notices("buyer").total());
        assertEquals(0, notices("seller").total());
        var buyerCounter = commit(transition(buyerId, Action.COUNTER, "22", 1));
        assertEquals(sellerId, buyerCounter.recipientId());
        assertTrue(worker.processOne());
        assertEquals(new BigDecimal("22.00"), notices("seller").items().get(0).payload().price());
        var sellerDecision = commit(transition(sellerId, Action.ACCEPT, "22", 2));
        assertEquals(buyerId, sellerDecision.recipientId());
        assertTrue(worker.processOne());
        assertEquals(2, notices("buyer").total());
        assertEquals(1, notices("seller").total());
        assertEquals(new BigDecimal("25.00"), sellerCounter.payload().price());
        assertEquals(new BigDecimal("22.00"), sellerDecision.payload().price());
        String json = tools.jackson.databind.json.JsonMapper.builder().build().writeValueAsString(notices("seller"));
        for (String excluded : List.of("actorId", "buyerId", "sellerId", "recipientId", "sourceEventKey", "internal", "secret"))
            assertFalse(json.contains(excluded), json);
    }

    @Test void buyerAcceptOrRejectOfSellerCounterNotifiesSellerAtCounterPrice() {
        for (Action action : List.of(Action.ACCEPT, Action.REJECT)) {
            commit(transition(sellerId, Action.COUNTER, "25", 0));
            assertTrue(worker.processOne());
            var source = commit(transition(buyerId, action, "25", 1));
            assertEquals(sellerId, source.recipientId());
            assertTrue(worker.processOne());
            assertEquals(1, notices("seller").total());
            assertEquals(1, notices("buyer").total());
            assertEquals(new BigDecimal("25.00"), notices("seller").items().get(0).payload().price());
            assertEquals(action == Action.ACCEPT ? PrivateNotification.Status.ACCEPTED : PrivateNotification.Status.REJECTED,
                    notices("seller").items().get(0).payload().status());
            mongo.getCollection("notifications").deleteMany(new Document());
            mongo.getCollection("notificationOutbox").deleteMany(new Document());
            mongo.getCollection("offerCommandFixtures").updateOne(new Document("_id", offerId), new Document("$set", new Document("version", 0L)));
        }
    }

    @Test void appenderAndDeliveryReplayKeepOneEventAndOneNotice() {
        var transition = transition(sellerId, Action.ACCEPT, "20", 0);
        var original = commit(transition);
        assertEquals(original.id(), transactions.execute(tx -> appender.append(transition, UpdateResult.acknowledged(1, 1L, null))).id());
        assertThrows(IllegalStateException.class, () -> transactions.execute(tx -> appender.append(
                transition(sellerId, Action.REJECT, "20", 0), UpdateResult.acknowledged(1, 1L, null))));
        assertTrue(worker.processOne());
        assertEquals(original.id(), transactions.execute(tx -> appender.append(transition, UpdateResult.acknowledged(1, 1L, null))).id());
        assertFalse(worker.processOne());
        inbox.persist(original);
        inbox.persist(original);
        assertEquals(1, notices("buyer").total());
        assertEquals(1, mongo.count(new Query(), NotificationOutboxEvent.class));
    }

    @Test void staleAndFailedCommandsProduceNoFalseEvents() {
        assertThrows(OptimisticLockingFailureException.class, () -> commit(transition(sellerId, Action.REJECT, "20", 4)));
        var change = transition(sellerId, Action.COUNTER, "20", 0);
        assertThrows(IllegalStateException.class, () -> transactions.executeWithoutResult(tx -> {
            appender.append(change, update(change));
            throw new IllegalStateException("Injected failure before commit");
        }));
        assertEquals(0L, mongo.getCollection("offerCommandFixtures").find().first().getLong("version"));
        assertEquals(0, mongo.count(new Query(), NotificationOutboxEvent.class));
        assertFalse(worker.processOne());
        assertEquals(0, notices("buyer").total());
        assertEquals(0, notices("seller").total());
    }

    @Test void concurrentVersionedCommandsPermitOnlyOneEvent() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            var start = new CountDownLatch(1);
            List<Future<Boolean>> attempts = new ArrayList<>();
            for (Action action : List.of(Action.ACCEPT, Action.REJECT)) attempts.add(pool.submit(() -> {
                assertTrue(start.await(10, TimeUnit.SECONDS));
                try { commit(transition(sellerId, action, "20", 0)); return true; }
                catch (org.springframework.dao.DataAccessException | org.springframework.transaction.TransactionException conflict) { return false; }
            }));
            start.countDown();
            int winners = 0;
            for (var attempt : attempts) if (attempt.get(20, TimeUnit.SECONDS)) winners++;
            assertEquals(1, winners);
            assertEquals(1, mongo.count(new Query(), NotificationOutboxEvent.class));
            assertTrue(worker.processOne());
            assertFalse(worker.processOne());
            assertEquals(1, notices("buyer").total());
            assertEquals(0, notices("seller").total());
        } finally { pool.shutdownNow(); }
    }

    @Test void invalidActorVersionPriceAndNontransactionalCallsCannotEmit() {
        assertThrows(IllegalArgumentException.class, () -> transition(new ObjectId(), Action.ACCEPT, "20", 0));
        assertThrows(IllegalArgumentException.class, () -> transition(sellerId, Action.COUNTER, "0", 0));
        assertThrows(IllegalArgumentException.class, () -> transition(sellerId, Action.COUNTER, "1.001", 0));
        assertThrows(IllegalArgumentException.class, () -> new Transition(offerId, listingId, buyerId, sellerId,
                sellerId, buyerId, Action.ACCEPT, BigDecimal.TEN, 0, 2, now));
        for (Action action : Action.values())
            assertThrows(IllegalArgumentException.class, () -> new Transition(offerId, listingId, buyerId, sellerId,
                    sellerId, sellerId, action, BigDecimal.TEN, 0, 1, now));
        assertThrows(IllegalStateException.class, () -> appender.append(transition(sellerId, Action.ACCEPT, "20", 0), UpdateResult.acknowledged(1, 1L, null)));
        for (UpdateResult failed : List.of(UpdateResult.unacknowledged(), UpdateResult.acknowledged(0, 0L, null),
                UpdateResult.acknowledged(1, 0L, null)))
            assertThrows(OptimisticLockingFailureException.class, () -> transactions.execute(tx ->
                    appender.append(transition(sellerId, Action.ACCEPT, "20", 0), failed)));
        assertEquals(0, mongo.count(new Query(), NotificationOutboxEvent.class));
    }
}
