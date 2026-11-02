package edu.augustana.csc305.project;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import edu.augustana.csc305.project.config.*;
import edu.augustana.csc305.project.dto.SubmitReportRequest;
import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.*;
import edu.augustana.csc305.project.service.*;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;

import static edu.augustana.csc305.project.model.ModerationTypes.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Requires a replica set/Atlas; single-server MongoDB cannot validate transactions. */
@EnabledIfEnvironmentVariable(named = "MODERATION_TEST_MONGODB_URI", matches = ".+")
class ReportSubmissionMongoTest {
    @TempDir Path uploads;
    private MongoClient client;
    private MongoTemplate mongo;
    private UserRepository users;
    private ListingRepository listings;
    private ListingEvidenceService evidence;
    private String database;
    private final SubmitReportRequest body = new SubmitReportRequest("OTHER", "Please review this listing.");

    @BeforeEach
    void setup() {
        database = "report_test_" + new ObjectId().toHexString();
        client = MongoClients.create(System.getenv("MODERATION_TEST_MONGODB_URI"));
        mongo = new MongoTemplate(client, database);
        ModerationSchema.initialize(mongo);
        users = new UserRepository(mongo);
        listings = mock(ListingRepository.class);
        when(listings.findById(any(ObjectId.class))).thenAnswer(call ->
                Optional.ofNullable(mongo.findById(call.getArgument(0), Listing.class)));
        evidence = new ListingEvidenceService(mongo, listings, users,
                new ImageStorageService(uploads.toString(), "/api/v1"));
    }

    @AfterEach
    void cleanup() {
        if (client == null) return;
        try {
            if (database != null && database.startsWith("report_test_")) {
                for (String collection : client.getDatabase(database).listCollectionNames()) {
                    client.getDatabase(database).getCollection(collection).deleteMany(new Document());
                }
            }
        } finally { client.close(); }
    }

    private ReportSubmissionService service(int limit) {
        return new ReportSubmissionService(mongo, users, evidence,
                new ReportTransactionConfig().reportTransactions(mongo.getMongoDatabaseFactory()), limit, 3600);
    }

    private User reporter() {
        ObjectId id = new ObjectId();
        User user = new User(id, "Reporter", id.toHexString() + "@augustana.edu", "hash");
        user.setEmailVerified(true);
        users.storeUser(user);
        return user;
    }

    private UsernamePasswordAuthenticationToken auth(User user) {
        return new UsernamePasswordAuthenticationToken(user.getEmail(), null, List.of());
    }

    private Listing listing() throws Exception {
        Listing listing = new Listing();
        listing.setId(new ObjectId());
        listing.setOwnerId(new ObjectId());
        listing.setTitle("Original title");
        listing.setDescription("Original description");
        listing.setPrice(new BigDecimal("15.00"));
        listing.setCategory("Furniture");
        String filename = UUID.randomUUID() + ".jpg";
        Files.write(uploads.resolve(filename), new byte[]{(byte)255, (byte)216, (byte)255, 1});
        listing.setImageUrl("/api/v1/images/" + filename);
        return mongo.insert(listing);
    }

    private List<ReportSubmissionService.Submission> concurrent(List<Callable<ReportSubmissionService.Submission>> actions)
            throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(actions.size());
        CountDownLatch ready = new CountDownLatch(actions.size());
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<ReportSubmissionService.Submission>> futures = new ArrayList<>();
            for (var action : actions) futures.add(pool.submit(() -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Start timed out");
                return action.call();
            }));
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            List<ReportSubmissionService.Submission> results = new ArrayList<>();
            for (var future : futures) results.add(future.get(60, TimeUnit.SECONDS));
            return results;
        } finally {
            start.countDown();
            pool.shutdownNow();
            assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS));
        }
    }

    @Test
    void duplicateKeysAndChangedReasonsDoNotGrowRequestRecordsOrReplaceEvidence() throws Exception {
        Listing listing = listing();
        User user = reporter();
        var service = service(1);
        var original = service.submit(listing.getId().toHexString(), body, "original-key", auth(user));
        for (int i = 0; i < 24; i++) {
            var changed = new SubmitReportRequest("SUSPECTED_SCAM", "Different reason " + i);
            var conflict = assertThrows(ReportSubmissionService.ReportConflict.class,
                    () -> service.submit(listing.getId().toHexString(), changed, UUID.randomUUID().toString(), auth(user)));
            assertEquals("REPORT_ALREADY_EXISTS", conflict.code());
            assertTrue(conflict.getReason().contains("were not saved"));
        }
        Report saved = mongo.findById(new ObjectId(original.status().reportId()), Report.class);
        assertEquals(body.description(), saved.description());
        assertEquals(ReportCategory.OTHER, saved.category());
        assertEquals(1, mongo.count(new Query(), ReportRequest.class));
        assertEquals(1, mongo.count(new Query(), Report.class));
        assertEquals(1, mongo.count(new Query(), ListingSnapshot.class));
        assertEquals(1, mongo.findById(user.getId(), ReportRateWindow.class).count());
        assertEquals(original.status().reportId(), service.submit(listing.getId().toHexString(),body,"original-key",auth(user))
                .status().reportId());
    }

    @Test
    void listingVersionStillPersistsAndRejectsStaleRepositorySaves() throws Exception {
        Listing listing = listing();
        ListingRepository real = new org.springframework.data.mongodb.repository.support.MongoRepositoryFactory(mongo)
                .getRepository(ListingRepository.class);
        Listing first = real.findById(listing.getId()).orElseThrow();
        Listing stale = real.findById(listing.getId()).orElseThrow();
        Long originalVersion = first.getVersion();
        first.setTitle("Saved title");
        Listing updated = real.save(first);
        assertEquals(originalVersion+1, updated.getVersion());
        assertEquals(updated.getVersion(), real.findById(listing.getId()).orElseThrow().getVersion());
        stale.setTitle("Stale title");
        assertThrows(org.springframework.dao.OptimisticLockingFailureException.class, () -> real.save(stale));
        assertEquals("Saved title", real.findById(listing.getId()).orElseThrow().getTitle());
        var json = tools.jackson.databind.json.JsonMapper.builder().build().valueToTree(updated);
        assertFalse(json.has("version"));
    }

    @Test
    void reportBetweenSellerReadAndSaveReturnsUseful409AndPreservesOriginalEvidence() throws Exception {
        Listing listing = listing();
        User reporter = reporter();
        User seller = new User(listing.getOwnerId(),"Seller","seller@augustana.edu","hash");
        users.storeUser(seller);
        ListingRepository real = new org.springframework.data.mongodb.repository.support.MongoRepositoryFactory(mongo)
                .getRepository(ListingRepository.class);
        ListingRepository interleaved = mock(ListingRepository.class);
        when(interleaved.findById(listing.getId())).thenAnswer(call -> real.findById(listing.getId()));
        when(interleaved.save(any(Listing.class))).thenAnswer(call -> {
            // The seller has read version N. A report commits its version fence before the seller writes.
            service(5).submit(listing.getId().toHexString(),body,"report-during-edit",auth(reporter));
            return real.save(call.getArgument(0));
        });
        var sellerService = new ListingService(interleaved,users,mongo);
        var mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(
                new edu.augustana.csc305.project.controller.ListingController(sellerService))
                .setControllerAdvice(new edu.augustana.csc305.project.controller.ListingConflictAdvice()).build();
        var result = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .put("/home/"+listing.getId()).principal(auth(seller)).contentType("application/json")
                .content("{\"title\":\"Seller edit\",\"description\":\"Edited text\",\"category\":\"Furniture\","
                        +"\"price\":20,\"condition\":\"Good\",\"pickupArea\":\"Campus\",\"listingType\":\"For sale\"}"))
                .andReturn().getResponse();
        assertEquals(409,result.getStatus());
        assertTrue(result.getContentAsString().contains("LISTING_CHANGED"));
        assertTrue(result.getContentAsString().contains("Your changes were not saved"));
        assertTrue(result.getContentAsString().contains("Refresh"));
        assertEquals("Original title",real.findById(listing.getId()).orElseThrow().getTitle());
        assertEquals(1,mongo.count(new Query(),Report.class));
        ListingSnapshot snapshot = mongo.findOne(new Query(),ListingSnapshot.class);
        assertEquals("Original title",snapshot.title());
        assertEquals("Original description",snapshot.description());
        assertTrue(real.findById(listing.getId()).orElseThrow().getVersion() > snapshot.sourceListingVersion());
    }

    @Test
    void resolvedSchemaInitializationKeepsReportBootstrapAndModerationIndexesRepeatable() {
        ModerationSchema.initialize(mongo);
        ModerationSchema.initialize(mongo);
        assertTrue(mongo.getCollection("reportRequests").listIndexes().into(new ArrayList<>()).stream()
                .anyMatch(index -> "report_request_history".equals(index.getString("name"))));
        assertTrue(mongo.getCollection("reportRateWindows").listIndexes().into(new ArrayList<>()).stream()
                .anyMatch(index -> "report_rate_window_start".equals(index.getString("name"))));
        assertTrue(mongo.getCollection("moderationCases").listIndexes().into(new ArrayList<>()).stream()
                .anyMatch(index -> "one_active_case_per_listing".equals(index.getString("name")) && Boolean.TRUE.equals(index.getBoolean("unique"))));
        assertTrue(mongo.getCollection("reports").listIndexes().into(new ArrayList<>()).stream()
                .anyMatch(index -> "one_reporter_per_case".equals(index.getString("name")) && Boolean.TRUE.equals(index.getBoolean("unique"))));
    }

    @Test
    void differentReportersConcurrentlyShareOneCaseWithExactCountsAndVisibleListing() throws Exception {
        Listing listing = listing();
        var service = service(5);
        List<Callable<ReportSubmissionService.Submission>> actions = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            User user = reporter();
            actions.add(() -> service.submit(listing.getId().toHexString(), body, "request", auth(user)));
        }
        var results = concurrent(actions);
        assertTrue(results.stream().allMatch(ReportSubmissionService.Submission::created));
        assertEquals(1, results.stream().map(result -> result.status().referenceNumber()).distinct().count());
        assertEquals(1, mongo.count(new Query(), ModerationCase.class));
        assertEquals(4, mongo.count(new Query(), Report.class));
        assertEquals(4, mongo.count(new Query(), ListingSnapshot.class));
        ModerationCase active = mongo.findOne(new Query(), ModerationCase.class);
        assertNotNull(active);
        assertEquals(4, new ModerationStore(mongo).reportCount(active.id()));
        Listing unchanged = mongo.findById(listing.getId(), Listing.class);
        assertNotNull(unchanged);
        assertEquals(ListingStatus.AVAILABLE, unchanged.getStatus());
        assertEquals(Visibility.VISIBLE, unchanged.getModerationVisibility());
    }

    @Test
    void simultaneousSameRequestAndDifferentKeyRetriesDoNotInflateCounts() throws Exception {
        Listing listing = listing();
        User user = reporter();
        var service = service(1);
        java.util.function.Function<String, Callable<ReportSubmissionService.Submission>> attempt = key -> () -> {
            try { return service.submit(listing.getId().toHexString(), body, key, auth(user)); }
            catch (ReportSubmissionService.ReportConflict duplicate) {
                assertEquals("REPORT_ALREADY_EXISTS", duplicate.code());
                return new ReportSubmissionService.Submission(duplicate.existingReport(), false);
            }
        };
        var results = concurrent(List.of(attempt.apply("same"), attempt.apply("same"), attempt.apply("different")));
        assertEquals(1, results.stream().filter(ReportSubmissionService.Submission::created).count());
        assertEquals(1, results.stream().map(result -> result.status().reportId()).distinct().count());
        assertEquals(1, mongo.count(new Query(), Report.class));
        assertEquals(1, mongo.count(new Query(), ListingSnapshot.class));
        assertEquals(1, mongo.count(new Query(), ModerationCase.class));
        assertEquals(1, mongo.findById(user.getId(), ReportRateWindow.class).count());
        attempt.apply("same").call();
        assertEquals(1, mongo.count(new Query(), Report.class));
        assertEquals(1, mongo.count(new Query(), ReportRequest.class));
    }

    @Test
    void failedRetentionRollsBackCaseReportSnapshotQuotaAndIdempotencyThenRetryWorks() throws Exception {
        Listing listing = listing();
        User user = reporter();
        var service = service(1);
        Path image = uploads.resolve(listing.getImageUrl().substring("/api/v1/images/".length()));
        byte[] bytes = Files.readAllBytes(image);
        Files.delete(image);
        assertThrows(ResponseStatusException.class,
                () -> service.submit(listing.getId().toHexString(), body, "retry", auth(user)));
        for (Class<?> type : List.of(Report.class, ListingSnapshot.class, ModerationCase.class,
                ReportRateWindow.class, ReportRequest.class)) assertEquals(0, mongo.count(new Query(), type));
        Files.write(image, bytes);
        assertTrue(service.submit(listing.getId().toHexString(), body, "retry", auth(user)).created());
        assertEquals(1, mongo.count(new Query(), Report.class));
        assertEquals(1, mongo.count(new Query(), ListingSnapshot.class));
        try (var files = Files.list(uploads)) { assertEquals(1, files.count()); }
    }

    @Test
    void concurrentDifferentTargetsCannotExceedSharedReporterRateLimit() throws Exception {
        Listing first = listing();
        Listing second = listing();
        User user = reporter();
        var service = service(1);
        List<Callable<ReportSubmissionService.Submission>> actions = new ArrayList<>();
        for (Listing target : List.of(first, second)) actions.add(() -> {
            try { return service.submit(target.getId().toHexString(), body, target.getId().toHexString(), auth(user)); }
            catch (ReportSubmissionService.RateLimitExceeded expected) { return null; }
        });
        var results = concurrent(actions);
        assertEquals(1, results.stream().filter(Objects::nonNull).count());
        assertEquals(1, mongo.count(new Query(), Report.class));
        assertEquals(1, mongo.count(new Query(), ListingSnapshot.class));
        assertEquals(1, mongo.count(new Query(), ModerationCase.class));
    }

    @Test
    void resolutionAllowsLinkedNewCaseAndOwnHistoryExcludesOtherReporter() throws Exception {
        Listing listing = listing();
        User first = reporter();
        User second = reporter();
        var service = service(5);
        var original = service.submit(listing.getId().toHexString(), body, "first", auth(first));
        service.submit(listing.getId().toHexString(), body, "other", auth(second));
        assertEquals(1, service.ownReports(auth(first), 0, 20).size());
        Report priorReport = mongo.findById(new ObjectId(original.status().reportId()), Report.class);
        mongo.updateFirst(Query.query(Criteria.where("_id").is(priorReport.caseId())),
                new Update().set("status", CaseStatus.RESOLVED).inc("version", 1L), ModerationCase.class);
        var next = service.submit(listing.getId().toHexString(), body, "next", auth(first));
        Report nextReport = mongo.findById(new ObjectId(next.status().reportId()), Report.class);
        ModerationCase nextCase = mongo.findById(nextReport.caseId(), ModerationCase.class);
        assertEquals(priorReport.caseId(), nextCase.previousCaseId());
        assertEquals(2, service.ownReports(auth(first), 0, 20).size());
        assertEquals(1, service.ownReports(auth(second), 0, 20).size());
        assertEquals(3, mongo.count(new Query(), Report.class));
        // Exact old-key replay returns the original report after resolution.
        assertEquals(original.status().reportId(), service.submit(listing.getId().toHexString(), body, "first", auth(first))
                .status().reportId());
    }
}
