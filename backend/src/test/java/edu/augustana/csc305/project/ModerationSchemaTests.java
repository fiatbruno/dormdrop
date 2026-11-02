package edu.augustana.csc305.project;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import edu.augustana.csc305.project.config.ModerationSchema;
import edu.augustana.csc305.project.dto.ModerationDtos;
import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.ModerationStore;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;

import static edu.augustana.csc305.project.model.ModerationTypes.*;
import static org.junit.jupiter.api.Assertions.*;

class ModerationSchemaTests {
    @Test
    void caseGetsReadableReferenceAndUtcTimestamp() {
        ModerationCase reportCase =
                ModerationCase.open(new ObjectId(), null);

        assertEquals(
                "RPT-" + reportCase.id().toHexString()
                        .toUpperCase(java.util.Locale.ROOT),
                reportCase.referenceNumber()
        );

        assertNotNull(reportCase.createdAt());
        assertEquals(reportCase.createdAt(), reportCase.updatedAt());
        assertEquals(CaseStatus.OPEN, reportCase.status());
    }

    @Test
    void sellerAndReporterContractsExcludeInternalFields() {
        assertEquals(
                List.of(
                        "referenceNumber",
                        "action",
                        "message",
                        "decidedAt"
                ),
                fields(ModerationDtos.SellerNotice.class)
        );

        assertEquals(
                List.of(
                        "reportId",
                        "referenceNumber",
                        "status",
                        "submittedAt"
                ),
                fields(ModerationDtos.ReporterStatus.class)
        );

        assertTrue(fields(ModerationDtos.StaffDecision.class)
                .contains("internalRationale"));

        assertTrue(fields(ModerationDtos.StaffEvidence.class)
                .contains("privateEvidenceKeys"));
    }

    @Test
    void sellerMappingUsesPublicMessageOnly() {
        ModerationCase reportCase =
                ModerationCase.open(new ObjectId(), null);

        ModerationDecision decision = new ModerationDecision(
                new ObjectId(),
                reportCase.id(),
                new ObjectId(),
                DecisionAction.HIDE,
                "Private investigation notes",
                "Your listing has been hidden.",
                "Your report was reviewed.",
                null,
                0,
                Instant.now()
        );

        var response =
                ModerationDtos.sellerNotice(decision, reportCase);

        assertEquals(
                "Your listing has been hidden.",
                response.message()
        );

        assertEquals(
                reportCase.referenceNumber(),
                response.referenceNumber()
        );
    }

    private static List<String> fields(Class<?> type) {
        return Arrays.stream(type.getRecordComponents())
                .map(component -> component.getName())
                .toList();
    }

    @Nested
    @EnabledIfEnvironmentVariable(
            named = "MODERATION_TEST_MONGODB_URI",
            matches = ".+"
    )
    class DatabaseTests {
        private MongoClient client;
        private MongoTemplate mongo;
        private ModerationStore store;
        private String database;

        @BeforeEach
        void connect() {
            database = "moderation_test_"
                    // 15-byte prefix + 20 ASCII characters stays under Atlas's 38-byte limit.
                    + UUID.randomUUID().toString().replace("-", "").substring(0, 20);

            client = MongoClients.create(
                    System.getenv("MODERATION_TEST_MONGODB_URI")
            );

            mongo = new MongoTemplate(client, database);
            ModerationSchema.initialize(mongo);
            store = new ModerationStore(mongo);
        }

        @AfterEach
        void cleanup() {
            if (client != null) {
                try {
                    if (database != null
                            && database.startsWith("moderation_test_")) {
                        // Atlas test users may delete records without permission to drop databases.
                        // Only touch collections inside this test's randomly generated database.
                        for (String collection : client.getDatabase(database).listCollectionNames()) {
                            client.getDatabase(database).getCollection(collection)
                                    .deleteMany(new Document());
                        }
                    }
                } finally {
                    client.close();
                }
            }
        }

        @Test
        void migrationIsRepeatableAndPreservesLifecycle() {
            ObjectId legacy = new ObjectId();
            ObjectId hidden = new ObjectId();

            mongo.getCollection("listings").insertMany(List.of(
                    new Document("_id", legacy)
                            .append("status", "SOLD"),

                    new Document("_id", hidden)
                            .append("status", "RESERVED")
                            .append("moderationVisibility", "HIDDEN")
                            .append("version", 7L)
            ));

            ModerationSchema.initialize(mongo);
            ModerationSchema.initialize(mongo);

            Document old = mongo.getCollection("listings")
                    .find(new Document("_id", legacy)).first();

            Document existing = mongo.getCollection("listings")
                    .find(new Document("_id", hidden)).first();

            assertNotNull(old);
            assertNotNull(existing);

            assertEquals("SOLD", old.getString("status"));
            assertEquals("VISIBLE",
                    old.getString("moderationVisibility"));
            assertEquals(0L, old.getLong("version"));

            assertEquals("RESERVED", existing.getString("status"));
            assertEquals("HIDDEN",
                    existing.getString("moderationVisibility"));
            assertEquals(7L, existing.getLong("version"));
        }

        @Test
        void concurrentCaseInsertsPermitOneWinner() throws Exception {
            ObjectId listingId = new ObjectId();

            CountDownLatch ready = new CountDownLatch(2);
            CountDownLatch start = new CountDownLatch(1);

            ExecutorService pool = Executors.newFixedThreadPool(2);

            Callable<Boolean> insert = () -> {
                ready.countDown();

                if (!start.await(10, TimeUnit.SECONDS)) {
                    throw new IllegalStateException("Timed out.");
                }

                try {
                    store.createCase(listingId);
                    return true;
                } catch (DuplicateKeyException expected) {
                    return false;
                }
            };

            try {
                Future<Boolean> first = pool.submit(insert);
                Future<Boolean> second = pool.submit(insert);

                assertTrue(ready.await(10, TimeUnit.SECONDS));
                start.countDown();

                int winners =
                        (first.get(20, TimeUnit.SECONDS) ? 1 : 0)
                                + (second.get(20, TimeUnit.SECONDS) ? 1 : 0);

                assertEquals(1, winners);

                assertEquals(1, mongo.count(
                        Query.query(
                                Criteria.where("listingId").is(listingId)
                        ),
                        ModerationCase.class
                ));
            } finally {
                start.countDown();
                pool.shutdownNow();
            }
        }

        @Test
        void inReviewStillBlocksAnotherActiveCase() {
            ObjectId listingId = new ObjectId();
            ModerationCase original = store.createCase(listingId);

            mongo.updateFirst(
                    Query.query(Criteria.where("_id").is(original.id())),
                    new Update().set("status", CaseStatus.IN_REVIEW),
                    ModerationCase.class
            );

            assertThrows(
                    DuplicateKeyException.class,
                    () -> store.createCase(listingId)
            );
        }

        @Test
        void resolvedCaseAllowsLinkedNewCase() {
            ObjectId listingId = new ObjectId();
            ModerationCase original = store.createCase(listingId);

            mongo.updateFirst(
                    Query.query(Criteria.where("_id").is(original.id())),
                    new Update().set("status", CaseStatus.RESOLVED),
                    ModerationCase.class
            );

            ModerationCase next = store.createCase(listingId);

            assertNotEquals(original.id(), next.id());
            assertEquals(original.id(), next.previousCaseId());
            assertNotEquals(
                    original.referenceNumber(),
                    next.referenceNumber()
            );
        }

        @Test
        void correctionAppendsWithoutChangingOriginal() {
            ModerationCase reportCase =
                    store.createCase(new ObjectId());

            ObjectId staff = new ObjectId();

            ModerationDecision original = store.appendDecision(
                    new ModerationDecision(
                            new ObjectId(),
                            reportCase.id(),
                            staff,
                            DecisionAction.KEEP,
                            "Original rationale",
                            "Your listing remains visible.",
                            "Review completed.",
                            null,
                            0,
                            Instant.now()
                    )
            );

            store.appendDecision(new ModerationDecision(
                    new ObjectId(),
                    reportCase.id(),
                    staff,
                    DecisionAction.KEEP,
                    "Corrected rationale",
                    "Your listing remains visible.",
                    "Review completed.",
                    original.id(),
                    1,
                    Instant.now()
            ));

            ModerationDecision retained = mongo.findById(
                    original.id(),
                    ModerationDecision.class
            );

            assertNotNull(retained);
            assertEquals(
                    "Original rationale",
                    retained.internalRationale()
            );

            assertEquals(2, mongo.count(
                    Query.query(
                            Criteria.where("caseId").is(reportCase.id())
                    ),
                    ModerationDecision.class
            ));
        }
    }
}
