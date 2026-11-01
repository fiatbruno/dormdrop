package edu.augustana.csc305.project;

import com.mongodb.client.*;
import edu.augustana.csc305.project.config.*;
import edu.augustana.csc305.project.controller.*;
import edu.augustana.csc305.project.dto.*;
import edu.augustana.csc305.project.dto.ModerationDecisionDtos.*;
import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.*;
import edu.augustana.csc305.project.security.StaffAccess;
import edu.augustana.csc305.project.service.*;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.repository.support.MongoRepositoryFactory;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Stream;

import static edu.augustana.csc305.project.model.ModerationTypes.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@EnabledIfEnvironmentVariable(named="MODERATION_TEST_MONGODB_URI",matches=".+")
class ModerationDecisionMongoTest {
    @TempDir Path uploads;
    private MongoClient client;
    private MongoTemplate mongo;
    private String database;
    private UserRepository users;
    private ListingRepository listings;
    private User owner, moderator, admin, reporter;
    private ImageStorageService images;
    private final ListingVisibilityPolicy policy = new ListingVisibilityPolicy();

    @BeforeAll
    void connect() {
        database = "dec_test_"+new ObjectId();
        client = MongoClients.create(System.getenv("MODERATION_TEST_MONGODB_URI"));
        mongo = new MongoTemplate(client,database);
        ModerationSchema.initialize(mongo);
        users = new UserRepository(mongo);
        listings = new MongoRepositoryFactory(mongo).getRepository(ListingRepository.class);
    }
    @BeforeEach
    void setup() {
        owner = user(UserRole.STUDENT); moderator = user(UserRole.MODERATOR);
        admin = user(UserRole.ADMIN); reporter = user(UserRole.STUDENT);
        images = new ImageStorageService(uploads.toString(),"/api/v1");
    }
    @AfterEach
    void clearRecords() {
        if (client != null && database.startsWith("dec_test_"))
            for (String name : client.getDatabase(database).listCollectionNames())
                client.getDatabase(database).getCollection(name).deleteMany(new Document());
    }
    @AfterAll void close() {
        if (client != null) try { MongoTestCleanup.dropCollections(client,database,"dec_test_"); }
        finally { client.close(); }
    }
    private User user(UserRole role) {
        User user = new User(new ObjectId(),role.name(),new ObjectId()+"@augustana.edu","hash");
        user.setRole(role); user.setEmailVerified(true); users.storeUser(user); return user;
    }
    private UsernamePasswordAuthenticationToken auth(User user) {
        return new UsernamePasswordAuthenticationToken(user.getEmail(),null,List.of());
    }
    private Listing listing(ListingStatus status) throws Exception {
        Listing listing = new Listing(); listing.setId(new ObjectId()); listing.setOwnerId(owner.getId());
        listing.setTitle("Retained original title"); listing.setDescription("Retained original text");
        listing.setCategory("Furniture"); listing.setPrice(new BigDecimal("25.00")); listing.setStatus(status);
        String filename = UUID.randomUUID()+".jpg";
        Files.write(uploads.resolve(filename),new byte[]{(byte)255,(byte)216,(byte)255,1,2,3});
        listing.setImageUrl("/api/v1/images/"+filename); return listings.insert(listing);
    }
    private ModerationCase reportCase(Listing listing) { return mongo.insert(ModerationCase.open(listing.getId(),null)); }
    private Report report(ModerationCase reportCase,Listing listing) {
        ObjectId id = new ObjectId();
        Report report = new Report(id,reportCase.id(),listing.getId(),reporter.getId(),id,ReportCategory.OTHER,
                "Reported issue",new ObjectId().toHexString(),Instant.now());
        return new ListingEvidenceService(mongo,listings,users,images).retainAndInsertReport(report,listing.getVersion());
    }
    private ModerationDecisionService service() { return service(mongo); }
    private ModerationDecisionService service(MongoTemplate template) {
        return new ModerationDecisionService(template,new StaffAccess(users),new DecisionEvidenceService(template,users,images),
                new ReportTransactionConfig().reportTransactions(mongo.getMongoDatabaseFactory()));
    }
    private Request request(DecisionAction action,long expectedVersion) {
        return new Request(action,expectedVersion,"Policy reason","PRIVATE INTERNAL RATIONALE","Public seller notice");
    }
    private ModerationDecisionService.Outcome decide(ModerationCase reportCase,DecisionAction action) {
        return service().decide(ModerationDecisionService.Target.CASE,reportCase.id().toHexString(),
                request(action,reportCase.version()),"key-"+new ObjectId(),auth(moderator));
    }
    private long count(Class<?> type) { return mongo.count(new Query(),type); }
    private void denied(int status,org.junit.jupiter.api.function.Executable action) {
        assertEquals(status,assertThrows(ResponseStatusException.class,action).getStatusCode().value());
    }
    static Stream<Arguments> lifecycles() {
        return Arrays.stream(DecisionAction.values()).flatMap(action ->
                Stream.of(ListingStatus.AVAILABLE,ListingStatus.SOLD,ListingStatus.DONATED).map(status -> Arguments.of(action,status)));
    }
    @ParameterizedTest @MethodSource("lifecycles")
    void allActionsAreAtomicAndPreserveLifecycle(DecisionAction action,ListingStatus status) throws Exception {
        Listing listing = listing(status); ModerationCase reportCase = reportCase(listing);
        Report report = report(reportCase,listing);
        var result = decide(reportCase,action).result();
        Listing updated = listings.findById(listing.getId()).orElseThrow();
        assertEquals(status,updated.getStatus());
        assertEquals(action==DecisionAction.HIDE ? Visibility.HIDDEN : action==DecisionAction.REMOVE ? Visibility.REMOVED : Visibility.VISIBLE,
                updated.getModerationVisibility());
        ModerationCase changed = mongo.findById(reportCase.id(),ModerationCase.class);
        assertEquals(action==DecisionAction.HIDE ? CaseStatus.IN_REVIEW : CaseStatus.RESOLVED,changed.status());
        assertEquals(changed.status(),ModerationDtos.reporterStatus(report,changed).status());
        assertEquals(1L,changed.version()); assertEquals(listing.getVersion()+1,updated.getVersion());
        assertEquals(updated.getVersion(),result.listingVersion());
        assertEquals(1,count(ModerationDecision.class)); assertEquals(1,count(ActivityEvent.class));
        assertEquals(1,count(ModerationNotificationEvent.class)); assertEquals(1,count(ModerationDecisionReceipt.class));
        ModerationDecision stored = mongo.findOne(new Query(),ModerationDecision.class);
        assertEquals("Policy reason",stored.policyReason()); assertEquals(List.of(report.id()),stored.reviewedReportIds());
        assertNotNull(stored.snapshotId()); assertEquals(1,count(ListingSnapshot.class));
        ModerationNotificationEvent event = mongo.findOne(new Query(),ModerationNotificationEvent.class);
        assertEquals(owner.getId(),event.sellerRecipientId()); assertEquals("PENDING",event.status());
        assertFalse(event.sellerMessage().contains("PRIVATE"));
        assertEquals(action==DecisionAction.HIDE ? List.of() : List.of(reporter.getId()),event.reporterRecipientIds());
    }
    @ParameterizedTest @EnumSource(DecisionAction.class)
    void injectedOutboxFailureRollsBackEveryWriteIncludingNewCaseAndEvidence(DecisionAction action) throws Exception {
        Listing listing = listing(ListingStatus.DONATED);
        MongoTemplate failing = spy(mongo);
        doThrow(new org.springframework.dao.DataAccessResourceFailureException("injected outbox failure"))
                .when(failing).insert(any(ModerationNotificationEvent.class));
        denied(503,() -> service(failing).decide(ModerationDecisionService.Target.LISTING,listing.getId().toHexString(),
                request(action,listing.getVersion()),"failed-key",auth(moderator)));
        for (Class<?> type : List.of(ModerationDecision.class,ActivityEvent.class,ModerationNotificationEvent.class,
                ModerationDecisionReceipt.class,ModerationCase.class,ListingSnapshot.class)) assertEquals(0,count(type));
        Listing unchanged = listings.findById(listing.getId()).orElseThrow();
        assertEquals(Visibility.VISIBLE,unchanged.getModerationVisibility()); assertEquals(listing.getVersion(),unchanged.getVersion());
        assertEquals(ListingStatus.DONATED,unchanged.getStatus());
    }
    @Test
    void hideThenKeepRestoresOnlyTemporaryHideAndKeepsImmutableEvidence() throws Exception {
        Listing listing = listing(ListingStatus.AVAILABLE); ModerationCase reportCase = reportCase(listing);
        Report originalReport = report(reportCase,listing);
        Document original = mongo.getCollection("listingSnapshots").find(new Document("_id",originalReport.snapshotId())).first();
        decide(reportCase,DecisionAction.HIDE);
        Listing hidden = listings.findById(listing.getId()).orElseThrow();
        assertEquals(reportCase.id(),hidden.getTemporaryHideCaseId());
        assertEquals(CaseStatus.IN_REVIEW,mongo.findById(reportCase.id(),ModerationCase.class).status());
        var seller = new ListingService(listings,users,mongo,policy);
        denied(409,() -> seller.updateStatus(listing.getId(),ListingStatus.SOLD,owner.getEmail()));
        denied(409,() -> seller.deleteListing(listing.getId(),owner.getEmail()));
        var current = mongo.findById(reportCase.id(),ModerationCase.class);
        decide(current,DecisionAction.KEEP);
        Listing kept = listings.findById(listing.getId()).orElseThrow();
        assertEquals(Visibility.VISIBLE,kept.getModerationVisibility()); assertNull(kept.getTemporaryHideCaseId());
        assertEquals(CaseStatus.RESOLVED,mongo.findById(reportCase.id(),ModerationCase.class).status());
        assertEquals(original,mongo.getCollection("listingSnapshots").find(new Document("_id",originalReport.snapshotId())).first());
        assertEquals(2,count(ModerationDecision.class)); assertEquals(2,count(ModerationNotificationEvent.class));
        assertEquals(1,count(Report.class)); assertEquals(1,count(ListingSnapshot.class));
    }
    @ParameterizedTest @EnumSource(value=Visibility.class,names={"HIDDEN","REMOVED"})
    void keepCannotUndoAnUnrelatedRestriction(Visibility visibility) throws Exception {
        Listing listing = listing(ListingStatus.SOLD); ObjectId unrelated = new ObjectId();
        listing.setModerationVisibility(visibility); listing.setTemporaryHideCaseId(unrelated); listing = listings.save(listing);
        ModerationCase reportCase = reportCase(listing); decide(reportCase,DecisionAction.KEEP);
        Listing kept = listings.findById(listing.getId()).orElseThrow();
        assertEquals(visibility,kept.getModerationVisibility()); assertEquals(unrelated,kept.getTemporaryHideCaseId());
        assertEquals(ListingStatus.SOLD,kept.getStatus());
    }
    @Test
    void sellerCannotRestoreRemoveOrEditOriginalEvidence() throws Exception {
        Listing listing = listing(ListingStatus.SOLD); Listing stale = listings.findById(listing.getId()).orElseThrow();
        ModerationCase reportCase = reportCase(listing); Report report = report(reportCase,listing);
        decide(reportCase,DecisionAction.REMOVE);
        var seller = new ListingService(listings,users,mongo,policy);
        var edit = new CreateListingRequest("Edited","Edited","Furniture",BigDecimal.ZERO,"Good","Campus","For sale");
        denied(409,() -> seller.updateListing(listing.getId(),edit,owner.getEmail()));
        denied(409,() -> seller.updateStatus(listing.getId(),ListingStatus.AVAILABLE,owner.getEmail()));
        denied(409,() -> seller.deleteListing(listing.getId(),owner.getEmail()));
        denied(409,() -> new MyListingsService(mongo,users,policy).deleteMyListing(listing.getId().toHexString(),owner.getEmail()));
        denied(409,() -> new ImageController(images,listings,users,policy).uploadImage(listing.getId().toHexString(),
                new MockMultipartFile("file","image.jpg","image/jpeg",new byte[]{(byte)255,(byte)216,(byte)255}),auth(owner)));
        stale.setTitle("Stale edit"); stale.setModerationVisibility(Visibility.VISIBLE);
        assertThrows(org.springframework.dao.OptimisticLockingFailureException.class,() -> listings.save(stale));
        assertEquals(Visibility.REMOVED,listings.findById(listing.getId()).orElseThrow().getModerationVisibility());
        assertEquals(ListingStatus.SOLD,listings.findById(listing.getId()).orElseThrow().getStatus());
        ListingSnapshot snapshot = mongo.findById(report.snapshotId(),ListingSnapshot.class);
        assertEquals("Retained original title",snapshot.title()); assertFalse(snapshot.retainedImages().isEmpty());
    }
    @ParameterizedTest @EnumSource(value=DecisionAction.class,names={"KEEP","REMOVE"})
    void caseDecisionAfterOriginalDeletionPreservesDeletionAndRetainedEvidence(DecisionAction action) throws Exception {
        Listing listing = listing(ListingStatus.AVAILABLE); ModerationCase reportCase = reportCase(listing); Report report = report(reportCase,listing);
        ListingSnapshot snapshot = mongo.findById(report.snapshotId(),ListingSnapshot.class); listings.delete(listing);
        var result = decide(reportCase,action).result();
        assertTrue(result.listingDeleted()); assertNull(result.listingVersion()); assertNull(result.visibility());
        assertTrue(listings.findById(listing.getId()).isEmpty());
        assertArrayEquals(snapshot.retainedImages().get(0).bytes(),new ListingEvidenceController(mongo,users)
                .media(reportCase.id().toHexString(),snapshot.id().toHexString(),"image",auth(moderator)).getBody());
    }
    private List<ModerationDecisionService.Outcome> concurrent(List<Callable<ModerationDecisionService.Outcome>> actions) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(actions.size());
        CountDownLatch ready = new CountDownLatch(actions.size()); CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<ModerationDecisionService.Outcome>> futures = new ArrayList<>();
            for (var action : actions) futures.add(pool.submit(() -> { ready.countDown();
                if (!start.await(10,TimeUnit.SECONDS)) throw new IllegalStateException("Start timeout"); return action.call(); }));
            assertTrue(ready.await(10,TimeUnit.SECONDS)); start.countDown();
            List<ModerationDecisionService.Outcome> results = new ArrayList<>();
            for (var future : futures) results.add(future.get(45,TimeUnit.SECONDS)); return results;
        } finally { start.countDown(); pool.shutdownNow(); assertTrue(pool.awaitTermination(10,TimeUnit.SECONDS)); }
    }
    @ParameterizedTest @EnumSource(DecisionAction.class)
    void concurrentReviewersHaveOneWinnerAndStaleRequestGets409(DecisionAction action) throws Exception {
        Listing listing = listing(ListingStatus.AVAILABLE); ModerationCase reportCase = reportCase(listing);
        var commands = service(); List<Callable<ModerationDecisionService.Outcome>> attempts = new ArrayList<>();
        for (User reviewer : List.of(moderator,admin)) attempts.add(() -> {
            try { return commands.decide(ModerationDecisionService.Target.CASE,reportCase.id().toHexString(),request(action,0),reviewer.getId().toHexString(),auth(reviewer)); }
            catch (ResponseStatusException stale) { assertEquals(409,stale.getStatusCode().value()); return null; }
        });
        assertEquals(1,concurrent(attempts).stream().filter(Objects::nonNull).count());
        assertEquals(1,count(ModerationDecision.class)); assertEquals(1,count(ModerationNotificationEvent.class));
        assertEquals(1,count(ActivityEvent.class)); assertEquals(1,count(ModerationDecisionReceipt.class));
        denied(409,() -> commands.decide(ModerationDecisionService.Target.CASE,reportCase.id().toHexString(),request(action,0),"stale",auth(admin)));
    }
    @ParameterizedTest @EnumSource(DecisionAction.class)
    void concurrentSameKeyRetryAndLaterReplayHaveExactlyOneEvent(DecisionAction action) throws Exception {
        Listing listing = listing(ListingStatus.AVAILABLE); ModerationCase reportCase = reportCase(listing); var commands = service();
        Callable<ModerationDecisionService.Outcome> attempt = () -> commands.decide(ModerationDecisionService.Target.CASE,
                reportCase.id().toHexString(),request(action,0),"same-key",auth(moderator));
        var results = concurrent(List.of(attempt,attempt));
        assertEquals(1,results.stream().filter(ModerationDecisionService.Outcome::created).count());
        assertEquals(results.get(0).result(),results.get(1).result());
        assertEquals(results.get(0).result(),attempt.call().result());
        assertEquals(1,count(ModerationDecision.class)); assertEquals(1,count(ModerationNotificationEvent.class));
        assertEquals(1,count(ActivityEvent.class)); assertEquals(1,count(ModerationDecisionReceipt.class));
    }
    @Test
    void directListingCommandCreatesReviewableEvidenceWithoutInventingReports() throws Exception {
        Listing listing = listing(ListingStatus.DONATED);
        var result = service().decide(ModerationDecisionService.Target.LISTING,listing.getId().toHexString(),
                request(DecisionAction.REMOVE,listing.getVersion()),"direct",auth(admin)).result();
        assertEquals(0,count(Report.class)); assertEquals(1,count(ListingSnapshot.class));
        var staff = new StaffCaseService(mongo,users,new StaffAccess(users),new ReportTransactionConfig().reportTransactions(mongo.getMongoDatabaseFactory()));
        var detail = staff.detail(auth(moderator),result.caseId());
        assertEquals(1,detail.snapshots().size()); assertEquals("Retained original title",detail.snapshots().get(0).title());
        assertTrue(detail.reportGroups().isEmpty());
        denied(404,() -> new ImageController(images,listings,users,policy).getImage(listing.getImageUrl().substring("/api/v1/images/".length())));
    }
}
