package edu.augustana.csc305.project;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import edu.augustana.csc305.project.config.PrivateNotificationConfiguration;
import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.UserRepository;
import edu.augustana.csc305.project.service.*;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;

import static edu.augustana.csc305.project.model.PrivateNotification.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@EnabledIfEnvironmentVariable(named = "NOTIFICATION_TEST_MONGODB_URI", matches = ".+")
class PrivateNotificationMongoTest {
    private MongoClient client;
    private MongoTemplate mongo;
    private final String database = "notice_test_" + new ObjectId().toHexString();
    private final MutableClock clock = new MutableClock();
    private PrivateNotificationService service;
    private NotificationLeaseQueue queue;
    private PrivateNotificationWorker worker;
    private final User owner = new User(new ObjectId(), "Owner", "owner@example.edu", "hash");
    private final User other = new User(new ObjectId(), "Other", "other@example.edu", "hash");
    private final Authentication auth = authentication(owner);

    @BeforeAll
    void open() {
        client = MongoClients.create(System.getenv("NOTIFICATION_TEST_MONGODB_URI"));
        mongo = new MongoTemplate(client, database);
        PrivateNotificationConfiguration.initialize(mongo);
        // Explicitly create before transaction tests, rather than relying on transactional DDL.
        mongo.createCollection("fixtureCommands");
    }

    @BeforeEach
    void setup() {
        clock.now = Instant.parse("2026-11-01T18:00:00Z");
        var users = mock(UserRepository.class);
        when(users.findByEmail(owner.getEmail())).thenReturn(Optional.of(owner));
        when(users.findByEmail(other.getEmail())).thenReturn(Optional.of(other));
        service = spy(new PrivateNotificationService(mongo, users, clock));
        queue = new NotificationLeaseQueue(mongo, clock, 1, 10);
        worker = new PrivateNotificationWorker(mongo, queue, service, 50);
    }

    @AfterEach
    void clear() {
        for (String name : List.of("notifications", "notificationOutbox", "fixtureCommands"))
            mongo.getCollection(name).deleteMany(new Document());
    }

    @AfterAll
    void close() {
        try {
            if (client != null) {
                if (!database.matches("notice_test_[a-f0-9]{24}")) throw new IllegalStateException("Unsafe test database.");
                for (String name : List.of("notifications", "notificationOutbox", "fixtureCommands"))
                    client.getDatabase(database).getCollection(name).drop();
            }
        } finally { if (client != null) client.close(); }
    }

    private static Authentication authentication(User user) {
        return new UsernamePasswordAuthenticationToken(user.getEmail(), "unused", List.of());
    }

    private NotificationOutboxEvent event(String key, ObjectId recipient) {
        return new NotificationOutboxEvent(new ObjectId(), key, recipient, Type.OFFER_ACCEPTED,
                new ObjectId(), new ObjectId(), new Payload("Your offer was accepted.", Status.ACCEPTED,
                new BigDecimal("25.00")), clock.instant(), "PENDING");
    }

    private String deliver(String key) {
        var event = event(key, owner.getId());
        mongo.insert(event);
        assertTrue(worker.processOne());
        return PrivateNotificationService.notificationId(key, owner.getId());
    }

    @Test
    void indexesCanBeInstalledTwiceAndEnforceUniqueSources() {
        PrivateNotificationConfiguration.initialize(mongo);
        PrivateNotificationConfiguration.initialize(mongo);
        var first = event("unique", owner.getId());
        mongo.insert(first);
        assertThrows(org.springframework.dao.DuplicateKeyException.class,
                () -> mongo.insert(event("unique", other.getId())));
        service.persist(first);
        assertThrows(com.mongodb.MongoWriteException.class, () -> mongo.getCollection("notifications").insertOne(
                new Document("_id", "different-id").append("recipientId", owner.getId()).append("sourceEventKey", "unique")));
    }

    @Test
    void readPersistsAcrossSessionsAndReplayDoesNotResetIt() {
        String id = deliver("read");
        assertEquals(1, service.unreadCount(auth).count());
        var read = service.read(auth, id);
        clock.now = clock.now.plusSeconds(20);
        assertEquals(read.readAt(), service.read(authentication(owner), id).readAt());
        var newSession = new PrivateNotificationService(mongo, new UserRepository(mongo), clock);
        mongo.insert(owner);
        try {
            assertEquals(read.readAt(), newSession.list(authentication(owner), 0, 20).items().get(0).readAt());
        } finally { mongo.remove(new Query(), User.class); mongo.dropCollection(User.class); }
        service.persist(event("read", owner.getId()));
        assertEquals(0, service.unreadCount(auth).count());
        assertEquals(read.readAt(), service.list(auth, 0, 20).items().get(0).readAt());
    }

    @Test
    void paginationCountsAndTiedTimesAreStableAndPrivate() {
        List<String> ids = new ArrayList<>();
        for (int i = 0; i < 23; i++) ids.add(deliver("page-" + i));
        service.persist(event("private-other", other.getId()));
        ids.sort(Comparator.reverseOrder());
        var first = service.list(auth, 0, 20);
        var second = service.list(auth, 1, 20);
        assertEquals(ids.subList(0, 20), first.items().stream().map(n -> n.id()).toList());
        assertEquals(ids.subList(20, 23), second.items().stream().map(n -> n.id()).toList());
        assertEquals(23, first.total());
        assertEquals(23, first.unreadCount());
        assertTrue(service.list(auth, 2, 20).items().isEmpty());
        service.read(auth, ids.get(0));
        assertEquals(22, service.unreadCount(auth).count());
        assertEquals(22, service.list(auth, 0, 100).unreadCount());
        assertEquals(23, service.list(auth, 0, 100).total());
        for (int[] invalid : List.of(new int[]{-1, 20}, new int[]{0, 0}, new int[]{0, 101}))
            assertEquals(400, assertThrows(ResponseStatusException.class,
                    () -> service.list(auth, invalid[0], invalid[1])).getStatusCode().value());
    }

    @Test
    void guessedIdsAndAnonymousCannotReadOrList() {
        String id = deliver("owned");
        assertEquals(404, assertThrows(ResponseStatusException.class,
                () -> service.read(authentication(other), id)).getStatusCode().value());
        assertTrue(service.list(authentication(other), 0, 20).items().isEmpty());
        assertEquals(0, service.unreadCount(authentication(other)).count());
        assertEquals(401, assertThrows(ResponseStatusException.class, () -> service.list(null, 0, 20)).getStatusCode().value());
        assertEquals(401, assertThrows(ResponseStatusException.class, () -> service.read(null, id)).getStatusCode().value());
        assertEquals(401, assertThrows(ResponseStatusException.class, () -> service.unreadCount((Authentication) null)).getStatusCode().value());
        assertNull(service.list(auth, 0, 20).items().get(0).readAt());
    }

    @Test
    void persistenceFailureRetriesWithoutChangingCommittedCommand() {
        var event = event("failed", owner.getId());
        mongo.insert(event);
        mongo.getCollection("fixtureCommands").insertOne(new Document("_id", "committed-decision"));
        doThrow(new IllegalStateException("private notes must not be stored in retry errors"))
                .doCallRealMethod().when(service).persist(any());
        assertTrue(worker.processOne());
        assertEquals(0, mongo.count(new Query(), PrivateNotification.class));
        var pending = mongo.getCollection("notificationOutbox").find().first();
        assertEquals("RETRY", pending.getString("status"));
        assertEquals("IllegalStateException", pending.getString("lastError"));
        assertFalse(worker.processOne());
        clock.now = clock.now.plusSeconds(1);
        assertTrue(worker.processOne());
        assertEquals(1, mongo.count(new Query(), PrivateNotification.class));
        assertEquals(1, mongo.getCollection("fixtureCommands").countDocuments());
        assertEquals("DONE", mongo.getCollection("notificationOutbox").find().first().getString("status"));
    }

    @Test
    void interruptedWorkerAfterPersistenceRecoversWithoutDuplicateOrReadReset() {
        var event = event("crash", owner.getId());
        mongo.insert(event);
        var abandoned = queue.claim(PrivateNotificationWorker.COLLECTION);
        assertNotNull(abandoned);
        service.persist(event); // Simulate crash before acknowledgment.
        String id = PrivateNotificationService.notificationId(event.eventKey(), owner.getId());
        var read = service.read(auth, id);
        assertFalse(worker.processOne());
        clock.now = clock.now.plusSeconds(11);
        assertTrue(worker.processOne());
        assertEquals(1, mongo.count(new Query(), PrivateNotification.class));
        assertEquals(read.readAt(), service.list(auth, 0, 20).items().get(0).readAt());
        queue.retry(PrivateNotificationWorker.COLLECTION, abandoned, new IllegalStateException());
        assertEquals("DONE", mongo.getCollection("notificationOutbox").find().first().getString("status"));
    }

    @Test
    void concurrentWorkersAndConcurrentDuplicatePersistenceCreateOneNotice() throws Exception {
        var event = event("concurrent", owner.getId());
        mongo.insert(event);
        ExecutorService pool = Executors.newFixedThreadPool(4);
        try {
            var attempts = pool.invokeAll(List.<Callable<Boolean>>of(worker::processOne, worker::processOne));
            int winners = 0;
            for (var attempt : attempts) if (attempt.get(15, TimeUnit.SECONDS)) winners++;
            assertEquals(1, winners);
            var deliveries = pool.invokeAll(List.<Callable<Void>>of(
                    () -> { service.persist(event); return null; }, () -> { service.persist(event); return null; }));
            for (var delivery : deliveries) delivery.get(15, TimeUnit.SECONDS);
            assertEquals(1, service.list(auth, 0, 20).total());

            var cold = event("concurrent-first-insert", owner.getId());
            var start = new CountDownLatch(1);
            List<Future<Void>> inserts = new ArrayList<>();
            for (int i = 0; i < 4; i++) inserts.add(pool.submit(() -> {
                assertTrue(start.await(10, TimeUnit.SECONDS));
                service.persist(cold);
                return null;
            }));
            start.countDown();
            for (var insert : inserts) insert.get(15, TimeUnit.SECONDS);
            assertEquals(2, service.list(auth, 0, 20).total());
        } finally { pool.shutdownNow(); }
    }

    @Test
    void abortedTransactionPublishesNothingAndCommittedEventIsConsumed() {
        var transactions = new TransactionTemplate(new MongoTransactionManager(mongo.getMongoDatabaseFactory()));
        assertThrows(IllegalStateException.class, () -> transactions.executeWithoutResult(tx -> {
            mongo.getCollection("fixtureCommands").insertOne(new Document("_id", "aborted-command"));
            mongo.insert(event("aborted", owner.getId()));
            throw new IllegalStateException("Injected command failure");
        }));
        assertEquals(0, mongo.getCollection("fixtureCommands").countDocuments());
        assertFalse(worker.processOne());
        transactions.executeWithoutResult(tx -> {
            mongo.getCollection("fixtureCommands").insertOne(new Document("_id", "committed-command"));
            mongo.insert(event("committed", owner.getId()));
        });
        assertTrue(worker.processOne());
        assertEquals(1, service.list(auth, 0, 20).total());
    }

    @Test
    void workerCannotSeeUncommittedEvents() throws Exception {
        var transactions = new TransactionTemplate(new MongoTransactionManager(mongo.getMongoDatabaseFactory()));
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            transactions.executeWithoutResult(tx -> {
                mongo.insert(event("not-yet-committed", owner.getId()));
                try {
                    assertFalse(pool.submit(worker::processOne).get(15, TimeUnit.SECONDS));
                } catch (Exception failure) { throw new AssertionError(failure); }
            });
            assertTrue(worker.processOne());
            assertEquals(1, service.list(auth, 0, 20).total());
        } finally { pool.shutdownNow(); }
    }

    @Test
    void extraPrivateFieldsInEventNeverReachTheResponse() {
        var event = event("safe", owner.getId());
        mongo.insert(event);
        mongo.getCollection("notificationOutbox").updateOne(new Document("_id", event.id()),
                new Document("$set", new Document("internalNote", "secret-note")
                        .append("reporterIds", List.of(new ObjectId())).append("privateEvidenceKeys", List.of("secret-key"))
                        .append("payload.internalRationale", "secret-rationale")));
        assertTrue(worker.processOne());
        var json = tools.jackson.databind.json.JsonMapper.builder().build().writeValueAsString(service.list(auth, 0, 20));
        for (String excluded : List.of("secret", "internal", "reporterIds", "recipientId", "sourceEventKey", "leaseToken", "privateEvidence"))
            assertFalse(json.contains(excluded), json);
        assertTrue(json.contains("Your offer was accepted."));
        assertTrue(json.contains(event.offerId().toHexString()));
    }

    private OfferReceivedEventAppender.Submission submittedOffer() {
        return new OfferReceivedEventAppender.Submission(new ObjectId(), new ObjectId(), other.getId(), owner.getId(),
                "Buyer Display", new BigDecimal("12.50"), Instant.parse("2026-11-01T18:00:00.123456Z"));
    }

    /** Fixture only: #60 must insert its actual offer and call the appender in its command transaction. */
    private NotificationOutboxEvent commitOfferFixture(OfferReceivedEventAppender.Submission offer) {
        var transactions = new TransactionTemplate(new MongoTransactionManager(mongo.getMongoDatabaseFactory()));
        return transactions.execute(tx -> {
            if (mongo.getCollection("fixtureCommands").countDocuments(new Document("_id", offer.offerId())) == 0)
                mongo.getCollection("fixtureCommands").insertOne(new Document("_id", offer.offerId()).append("amount", offer.amount().toPlainString()));
            return new OfferReceivedEventAppender(mongo).append(offer);
        });
    }

    @Test
    void offerReceivedContractNotifiesOnlySellerWithSafeReferences() {
        var offer = submittedOffer();
        var source = commitOfferFixture(offer);
        assertTrue(worker.processOne());
        var sellerInbox = service.list(auth, 0, 20);
        assertEquals(1, sellerInbox.total());
        assertTrue(service.list(authentication(other), 0, 20).items().isEmpty());
        var notice = sellerInbox.items().get(0);
        assertEquals(Type.OFFER_RECEIVED, notice.type());
        assertEquals(Status.PENDING, notice.payload().status());
        assertEquals(new BigDecimal("12.50"), notice.payload().price());
        assertEquals("Buyer Display", notice.payload().buyerDisplayName());
        assertEquals(offer.offerId().toHexString(), notice.offerId());
        assertEquals(offer.listingId().toHexString(), notice.listingId());
        assertEquals(source.id().toHexString(), notice.eventId());
        String json = tools.jackson.databind.json.JsonMapper.builder().build().writeValueAsString(notice);
        for (String excluded : List.of("buyerId", "sellerId", "recipientId", "sourceEventKey", "email", "internal"))
            assertFalse(json.contains(excluded), json);
        assertFalse(json.contains(other.getId().toHexString()));
    }

    @Test
    void offerFixtureReplayAndDeliveryReplayKeepOneEventAndNotice() {
        var offer = submittedOffer();
        var original = commitOfferFixture(offer);
        var replay = commitOfferFixture(offer);
        assertEquals(original.id(), replay.id());
        assertEquals(1, mongo.getCollection("fixtureCommands").countDocuments());
        assertEquals(1, mongo.count(new Query(), NotificationOutboxEvent.class));
        assertTrue(worker.processOne());
        String id = PrivateNotificationService.notificationId(original.eventKey(), owner.getId());
        var read = service.read(auth, id);
        assertEquals(original.id(), commitOfferFixture(offer).id());
        assertFalse(worker.processOne()); // Same-key replay did not reset DONE to PENDING.
        service.persist(original);
        service.persist(original);
        var inbox = service.list(auth, 0, 20);
        assertEquals(1, inbox.total());
        assertEquals(read.readAt(), inbox.items().get(0).readAt());
        assertEquals(original.id().toHexString(), inbox.items().get(0).eventId());
    }

    @Test
    void failureAfterAppendingOfferEventRollsBackBothFixtureAndEvent() {
        var offer = submittedOffer();
        var transactions = new TransactionTemplate(new MongoTransactionManager(mongo.getMongoDatabaseFactory()));
        assertThrows(IllegalStateException.class, () -> transactions.executeWithoutResult(tx -> {
            mongo.getCollection("fixtureCommands").insertOne(new Document("_id", offer.offerId()));
            new OfferReceivedEventAppender(mongo).append(offer);
            throw new IllegalStateException("Injected before commit");
        }));
        assertEquals(0, mongo.getCollection("fixtureCommands").countDocuments());
        assertEquals(0, mongo.count(new Query(), NotificationOutboxEvent.class));
        assertFalse(worker.processOne());
        assertEquals(0, service.list(auth, 0, 20).total());
    }

    @Test
    void appenderRejectsNontransactionalUseAndChangedReplay() {
        var offer = submittedOffer();
        var appender = new OfferReceivedEventAppender(mongo);
        assertThrows(IllegalStateException.class, () -> appender.append(offer));
        assertEquals(0, mongo.count(new Query(), NotificationOutboxEvent.class));
        commitOfferFixture(offer);
        var changed = new OfferReceivedEventAppender.Submission(offer.offerId(), offer.listingId(), offer.buyerId(),
                offer.sellerId(), offer.buyerDisplayName(), new BigDecimal("99.00"), offer.submittedAt());
        assertThrows(IllegalStateException.class, () -> commitOfferFixture(changed));
        assertEquals(1, mongo.count(new Query(), NotificationOutboxEvent.class));
        assertTrue(worker.processOne());
        assertEquals(new BigDecimal("12.50"), service.list(auth, 0, 20).items().get(0).payload().price());
    }

    @Test
    void invalidOfferInputCannotAppendAnEventAndDisplayNameIsBounded() {
        var offer = submittedOffer();
        for (BigDecimal invalid : List.of(BigDecimal.ZERO, new BigDecimal("-1"), new BigDecimal("1.001"))) {
            assertThrows(IllegalArgumentException.class, () -> new OfferReceivedEventAppender.Submission(
                    offer.offerId(), offer.listingId(), offer.buyerId(), offer.sellerId(), "Name", invalid, offer.submittedAt()));
        }
        assertThrows(IllegalArgumentException.class, () -> new OfferReceivedEventAppender.Submission(
                offer.offerId(), offer.listingId(), owner.getId(), owner.getId(), "Name", offer.amount(), offer.submittedAt()));
        var safe = new OfferReceivedEventAppender.Submission(offer.offerId(), offer.listingId(), offer.buyerId(), offer.sellerId(),
                " Buyer\n\u0000\u202E" + "x".repeat(120), offer.amount(), offer.submittedAt());
        assertEquals(100, safe.buyerDisplayName().length());
        assertFalse(safe.buyerDisplayName().contains("\n"));
        assertFalse(safe.buyerDisplayName().contains("\u202E"));
        assertEquals(0, mongo.count(new Query(), NotificationOutboxEvent.class));
    }

    static class MutableClock extends Clock {
        Instant now;
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return now; }
    }
}
