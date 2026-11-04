package edu.augustana.csc305.project;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import edu.augustana.csc305.project.config.*;
import edu.augustana.csc305.project.controller.ListingEvidenceController;
import edu.augustana.csc305.project.dto.StaffCaseDtos.*;
import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.UserRepository;
import edu.augustana.csc305.project.security.StaffAccess;
import edu.augustana.csc305.project.service.StaffCaseService;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

import static edu.augustana.csc305.project.model.ModerationTypes.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfEnvironmentVariable(named="MODERATION_TEST_MONGODB_URI", matches=".+")
class StaffCaseMongoTest {
    private MongoClient client;
    private MongoTemplate mongo;
    private String database;
    private UserRepository users;
    private StaffCaseService service;
    private User moderator;

    @BeforeEach
    void setup() {
        database = "staff_test_" + new ObjectId().toHexString();
        client = MongoClients.create(System.getenv("MODERATION_TEST_MONGODB_URI"));
        mongo = new MongoTemplate(client, database);
        ModerationSchema.initialize(mongo);
        users = new UserRepository(mongo);
        moderator = staff(UserRole.MODERATOR);
        service = service(mongo);
    }

    private StaffCaseService service(MongoTemplate template) {
        return new StaffCaseService(template, users, new StaffAccess(users),
                new ReportTransactionConfig().reportTransactions(mongo.getMongoDatabaseFactory()));
    }
    private User staff(UserRole role) {
        User user = new User(new ObjectId(), "Staff", new ObjectId().toHexString()+"@augustana.edu", "private-hash");
        user.setRole(role);
        users.storeUser(user);
        return user;
    }
    private UsernamePasswordAuthenticationToken auth(User user) {
        return new UsernamePasswordAuthenticationToken(user.getEmail(), null, List.of());
    }
    private ModerationCase reportCase(CaseStatus status, Priority priority) {
        var draft = ModerationCase.open(new ObjectId(), null);
        return mongo.insert(new ModerationCase(draft.id(), draft.referenceNumber(), draft.listingId(), null, status,
                priority, null, Instant.parse("2026-10-31T00:00:00Z"), draft.updatedAt(), null));
    }
    private ListingSnapshot evidence(ModerationCase reportCase, String title) {
        ObjectId snapshotId = new ObjectId();
        var snapshot = mongo.insert(new ListingSnapshot(snapshotId, reportCase.id(), reportCase.listingId(),
                new ObjectId(), "Case seller", 0L, title, "Original evidence", "Furniture", new BigDecimal("12.50"),
                "Good", "Campus", "For sale", ListingStatus.AVAILABLE, List.of("image"), Instant.now(),
                List.of(new RetainedImage("image", "image/jpeg", new byte[]{(byte)255, (byte)216, (byte)255, 1}))));
        mongo.insert(new Report(new ObjectId(), reportCase.id(), reportCase.listingId(), new ObjectId(), snapshotId,
                ReportCategory.OTHER, "Please review", new ObjectId().toHexString(), Instant.now()));
        return snapshot;
    }

    @AfterEach
    void cleanup() {
        if (client == null) return;
        try {
            if (database != null && database.startsWith("staff_test_")) {
                MongoTestCleanup.dropCollections(client,database,"staff_test_");
            }
        } finally { client.close(); }
    }

    @Test
    void concurrentClaimsHaveOneWinnerAndStaleVersionReturns409() throws Exception {
        var reportCase = reportCase(CaseStatus.OPEN, Priority.HIGH);
        var admin = staff(UserRole.ADMIN);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<Boolean>> results = new ArrayList<>();
            for (User claimant : List.of(moderator, admin)) results.add(pool.submit(() -> {
                ready.countDown();
                assertTrue(start.await(10, TimeUnit.SECONDS));
                try {
                    service.assign(auth(claimant), reportCase.id().toHexString(), new Assignment(reportCase.version(), null));
                    return true;
                } catch (ResponseStatusException conflict) {
                    assertEquals(409, conflict.getStatusCode().value());
                    return false;
                }
            }));
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            int winners = 0;
            for (var result : results) if (result.get(30, TimeUnit.SECONDS)) winners++;
            assertEquals(1, winners);
            assertEquals(1, mongo.count(new Query(), ActivityEvent.class));
            var updated = mongo.findById(reportCase.id(), ModerationCase.class);
            assertNotNull(updated.assignedTo());
            assertEquals(1L, updated.version());
            assertEquals(409, assertThrows(ResponseStatusException.class, () -> service.assign(auth(moderator),
                    reportCase.id().toHexString(), new Assignment(0L, null))).getStatusCode().value());
        } finally {
            start.countDown(); pool.shutdownNow();
            assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS));
        }
    }

    @Test
    void filteredCountsAndStablePagesAgreeWithExactReportCounts() {
        var first = reportCase(CaseStatus.OPEN, Priority.HIGH);
        var second = reportCase(CaseStatus.OPEN, Priority.HIGH);
        reportCase(CaseStatus.RESOLVED, Priority.HIGH);
        reportCase(CaseStatus.OPEN, Priority.LOW);
        evidence(first, "First"); evidence(first, "Second report"); evidence(second, "Other");
        QueuePage page0 = service.queue(auth(moderator), CaseStatus.OPEN, Priority.HIGH, 0, 1);
        QueuePage page1 = service.queue(auth(moderator), CaseStatus.OPEN, Priority.HIGH, 1, 1);
        QueuePage page2 = service.queue(auth(moderator), CaseStatus.OPEN, Priority.HIGH, 2, 1);
        assertEquals(2, page0.total()); assertEquals(2, page1.total()); assertEquals(2, page2.total());
        assertEquals(2, page0.totalPages()); assertTrue(page2.items().isEmpty());
        assertNotEquals(page0.items().get(0).caseId(), page1.items().get(0).caseId());
        assertEquals(3, page0.items().get(0).reportCount() + page1.items().get(0).reportCount());
        List<String> descending = List.of(first.id().toHexString(), second.id().toHexString()).stream()
                .sorted(Comparator.reverseOrder()).toList();
        assertEquals(descending, List.of(page0.items().get(0).caseId(), page1.items().get(0).caseId()));
    }

    @Test
    void retainedDetailAndMediaRemainCaseScopedAfterOriginalDeletion() {
        var selected = reportCase(CaseStatus.OPEN, Priority.HIGH);
        var unrelated = reportCase(CaseStatus.OPEN, Priority.LOW);
        var snapshot = evidence(selected, "Retained title");
        evidence(unrelated, "UNRELATED SECRET");
        Listing original = new Listing(); original.setId(selected.listingId()); mongo.insert(original);
        mongo.remove(Query.query(Criteria.where("_id").is(selected.listingId())), Listing.class);
        var detail = service.detail(auth(moderator), selected.id().toHexString());
        assertEquals(1, detail.reportGroups().size()); assertEquals(1, detail.snapshots().size());
        assertEquals("Retained title", detail.snapshots().get(0).title());
        assertEquals(snapshot.sellerId().toHexString(), detail.seller().sellerId());
        var controller = new ListingEvidenceController(mongo, users);
        assertArrayEquals(snapshot.retainedImages().get(0).bytes(), controller.media(selected.id().toHexString(),
                snapshot.id().toHexString(), "image", auth(moderator)).getBody());
        assertEquals(404, assertThrows(ResponseStatusException.class, () -> controller.media(unrelated.id().toHexString(),
                snapshot.id().toHexString(), "image", auth(moderator))).getStatusCode().value());
    }

    @Test
    void failedAuditAppendRollsBackAssignment() {
        var reportCase = reportCase(CaseStatus.OPEN, Priority.HIGH);
        MongoTemplate failing = spy(mongo);
        doThrow(new org.springframework.dao.DataAccessResourceFailureException("audit failed"))
                .when(failing).insert(any(ActivityEvent.class));
        var broken = service(failing);
        assertEquals(503, assertThrows(ResponseStatusException.class, () -> broken.assign(auth(moderator),
                reportCase.id().toHexString(), new Assignment(0L, null))).getStatusCode().value());
        var unchanged = mongo.findById(reportCase.id(), ModerationCase.class);
        assertNull(unchanged.assignedTo()); assertEquals(0L, unchanged.version());
        assertEquals(0, mongo.count(new Query(), ActivityEvent.class));
    }
}
