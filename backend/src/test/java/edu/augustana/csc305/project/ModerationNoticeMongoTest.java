package edu.augustana.csc305.project;

import com.mongodb.client.*;
import edu.augustana.csc305.project.config.*;
import edu.augustana.csc305.project.controller.NotificationController;
import edu.augustana.csc305.project.dto.*;
import edu.augustana.csc305.project.dto.NotificationDtos.*;
import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.*;
import edu.augustana.csc305.project.security.StaffAccess;
import edu.augustana.csc305.project.service.*;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.data.mongodb.repository.support.MongoRepositoryFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

import static edu.augustana.csc305.project.model.ModerationTypes.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@EnabledIfEnvironmentVariable(named="MODERATION_TEST_MONGODB_URI",matches=".+")
class ModerationNoticeMongoTest {
    @TempDir Path uploads;
    private MongoClient client;
    private MongoTemplate mongo;
    private String database;
    private UserRepository users;
    private ListingRepository listings;
    private User owner,reporter1,reporter2,unrelated,staff;
    private MutableClock clock;
    private NotificationLeaseQueue leases;
    private NotificationInboxService inbox;
    private ModerationOutboxConsumer consumer;
    private Listing listing;
    private ModerationCase reportCase;
    private Report report1,report2;
    private ImageStorageService images;

    static class MutableClock extends Clock {
        private final AtomicReference<Instant> now=new AtomicReference<>(Instant.parse("2026-11-01T12:00:00Z"));
        public ZoneId getZone(){return ZoneOffset.UTC;}
        public Clock withZone(ZoneId zone){return this;}
        public Instant instant(){return now.get();}
        void advance(long seconds){now.updateAndGet(value->value.plusSeconds(seconds));}
    }
    @BeforeAll void connect() {
        database="notice_test_"+new ObjectId(); client=MongoClients.create(System.getenv("MODERATION_TEST_MONGODB_URI"));
        mongo=new MongoTemplate(client,database); ModerationSchema.initialize(mongo);
        users=new UserRepository(mongo); listings=new MongoRepositoryFactory(mongo).getRepository(ListingRepository.class);
    }
    @BeforeEach void setup() throws Exception {
        owner=user(); reporter1=user(); reporter2=user(); unrelated=user(); staff=user(); staff.setRole(UserRole.MODERATOR);
        mongo.save(staff);
        clock=new MutableClock(); leases=new NotificationLeaseQueue(mongo,clock,1,5);
        inbox=new NotificationInboxService(mongo,users,clock,"/api/v1"); consumer=new ModerationOutboxConsumer(mongo,leases,inbox,50);
        images=new ImageStorageService(uploads.toString(),"/api/v1");
        listing=new Listing(); listing.setId(new ObjectId()); listing.setOwnerId(owner.getId());
        listing.setTitle("PRIVATE_LISTING_TITLE"); listing.setDescription("PRIVATE_LISTING_DESCRIPTION");
        listing.setPrice(BigDecimal.TEN); listing.setCategory("Furniture");
        String filename=UUID.randomUUID()+".jpg"; Files.write(uploads.resolve(filename),new byte[]{(byte)255,(byte)216,(byte)255,1});
        listing.setImageUrl("/api/v1/images/"+filename); listing=listings.insert(listing);
        reportCase=mongo.insert(ModerationCase.open(listing.getId(),null));
        report1=report(reporter1); report2=report(reporter2);
    }
    @AfterEach void clear() {
        if(client!=null) for(String name:client.getDatabase(database).listCollectionNames())
            client.getDatabase(database).getCollection(name).deleteMany(new Document());
    }
    @AfterAll void close() {
        if(client!=null) try{MongoTestCleanup.dropCollections(client,database,"notice_test_");}finally{client.close();}
    }
    private User user(){User user=new User(new ObjectId(),"Member",new ObjectId()+"@augustana.edu","PRIVATE_PASSWORD_HASH");
        user.setEmailVerified(true);users.storeUser(user);return user;}
    private UsernamePasswordAuthenticationToken auth(User user){return new UsernamePasswordAuthenticationToken(user.getEmail(),null,List.of());}
    private Report report(User reporter){ObjectId id=new ObjectId();return new ListingEvidenceService(mongo,listings,users,images)
            .retainAndInsertReport(new Report(id,reportCase.id(),listing.getId(),reporter.getId(),id,ReportCategory.OTHER,
                    "PRIVATE_REPORT_DESCRIPTION",new ObjectId().toHexString(),clock.instant()),listing.getVersion());}
    private ModerationDecisionService decisions(MongoTemplate template){return new ModerationDecisionService(template,new StaffAccess(users),
            new DecisionEvidenceService(template,users,images),new ReportTransactionConfig().reportTransactions(mongo.getMongoDatabaseFactory()));}
    private ModerationDecisionService.Outcome remove(){return decisions(mongo).decide(ModerationDecisionService.Target.CASE,
            reportCase.id().toHexString(),new ModerationDecisionDtos.Request(DecisionAction.REMOVE,0L,"Prohibited item",
                    "PRIVATE_STAFF_RATIONALE","Safe seller message"),"remove",auth(staff));}
    private long count(Class<?> type){return mongo.count(new Query(),type);}
    private List<NotificationInboxEntry> entries(User user){return mongo.find(Query.query(Criteria.where("recipientId").is(user.getId())),NotificationInboxEntry.class);}
    private String json(Object object){return JsonMapper.builder().build().writeValueAsString(object);}
    private void denied(int status,org.junit.jupiter.api.function.Executable operation){assertEquals(status,
            assertThrows(ResponseStatusException.class,operation).getStatusCode().value());}
    private void privateFieldsAbsent(String value){for(String forbidden:List.of("reporterId","reporterRecipientIds","recipientId","sellerRecipientId",
            "sourceEventId","internalRationale","internalNote","privateEvidenceKeys","snapshotId","reviewedReportIds",
            "PRIVATE_STAFF_RATIONALE","PRIVATE_REPORT_DESCRIPTION","PRIVATE_LISTING_DESCRIPTION","PRIVATE_PASSWORD_HASH"))
        assertFalse(value.contains(forbidden),forbidden+" leaked");}

    @Test void removeCreatesOneSellerNoticeAndIsolatedReporterUpdates() {
        remove(); assertEquals(0,count(NotificationInboxEntry.class)); assertEquals(1,consumer.processBatch());
        assertEquals(3,count(NotificationInboxEntry.class)); assertEquals(1,entries(owner).size());
        assertEquals(1,entries(reporter1).size()); assertEquals(1,entries(reporter2).size()); assertTrue(entries(unrelated).isEmpty());
        var seller=inbox.list(auth(owner),0,20,false); assertEquals(1,seller.total()); assertEquals(1,seller.unread());
        SellerNotice view=assertInstanceOf(SellerNotice.class,seller.items().get(0));
        assertEquals("Prohibited item",view.reason()); assertEquals("Safe seller message",view.message()); assertEquals(DecisionAction.REMOVE,view.outcome());
        privateFieldsAbsent(json(seller)); assertFalse(json(seller).contains(report1.id().toHexString())); assertFalse(json(seller).contains(report2.id().toHexString()));
        var first=assertInstanceOf(ReporterUpdate.class,inbox.list(auth(reporter1),0,20,false).items().get(0));
        assertEquals(report1.id().toHexString(),first.report().reportId()); assertEquals(CaseStatus.RESOLVED,first.report().status());
        assertEquals(DecisionAction.REMOVE,first.outcome()); privateFieldsAbsent(json(first));
        assertFalse(json(first).contains(report2.id().toHexString())); assertFalse(json(first).contains(reporter2.getId().toHexString()));
        denied(404,()->inbox.get(auth(reporter1),view.id())); denied(404,()->inbox.read(auth(staff),view.id()));
        assertEquals(0,consumer.processBatch()); assertEquals(3,count(NotificationInboxEntry.class));
    }
    @Test void failedLiveDeliveryRetriesWithoutRollingBackDecisionOrDuplicatingInbox() {
        remove(); consumer.processBatch(); AtomicBoolean fail=new AtomicBoolean(true); List<String> delivered=new ArrayList<>();
        NotificationPublisher publisher=(recipient,view)->{if(recipient.equals(owner.getId())&&fail.getAndSet(false))
            throw new org.springframework.messaging.MessagingException("temporary live failure");
            delivered.add(((recipient.equals(owner.getId()))?"seller:":"reporter:")+json(view));};
        var worker=new NotificationDeliveryWorker(mongo,leases,inbox,publisher,50);
        assertEquals(2,worker.processBatch());
        assertEquals(Visibility.REMOVED,listings.findById(listing.getId()).orElseThrow().getModerationVisibility());
        assertEquals(CaseStatus.RESOLVED,mongo.findById(reportCase.id(),ModerationCase.class).status());
        assertEquals(1,count(ModerationDecision.class)); assertEquals(3,count(NotificationInboxEntry.class));
        assertEquals(1,inbox.list(auth(owner),0,20,false).items().size());
        assertEquals("RETRY",mongo.getCollection("notificationInbox").find(new Document("recipientId",owner.getId())).first().getString("status"));
        clock.advance(2); assertEquals(1,worker.processBatch()); assertEquals(0,worker.processBatch());
        assertEquals(1,delivered.stream().filter(value->value.startsWith("seller:")).count());
        assertEquals(3,delivered.size()); for(String value:delivered)privateFieldsAbsent(value);
        assertEquals(3,count(NotificationInboxEntry.class)); assertEquals(1,count(ModerationNotificationEvent.class));
    }
    @Test void partialFanoutFailureRetriesUsingSameDeduplicationIds() {
        remove(); MongoTemplate failing=spy(mongo); AtomicBoolean fail=new AtomicBoolean(true);
        doAnswer(call->{Update update=call.getArgument(1);Object recipient=update.getUpdateObject().get("$setOnInsert",Document.class).get("recipientId");
            if(recipient.equals(reporter1.getId())&&fail.getAndSet(false))throw new org.springframework.dao.DataAccessResourceFailureException("injected");
            return mongo.upsert((Query)call.getArgument(0),update,NotificationInboxEntry.class);
        }).when(failing).upsert(any(Query.class),any(Update.class),eq(NotificationInboxEntry.class));
        var retryInbox=new NotificationInboxService(failing,users,clock,"/api/v1");
        var retryConsumer=new ModerationOutboxConsumer(mongo,leases,retryInbox,50);
        assertEquals(0,retryConsumer.processBatch()); assertEquals(1,entries(owner).size());
        assertEquals("RETRY",mongo.getCollection(ModerationOutboxConsumer.COLLECTION).find().first().getString("status"));
        assertEquals(Visibility.REMOVED,listings.findById(listing.getId()).orElseThrow().getModerationVisibility());
        clock.advance(2);assertEquals(1,retryConsumer.processBatch());assertEquals(3,count(NotificationInboxEntry.class));
        assertEquals(1,entries(owner).size());assertEquals(1,entries(reporter1).size());assertEquals(1,entries(reporter2).size());
    }
    @Test void crashedWorkerLeaseExpiresAndStaleOwnerCannotChangeCompletedEvent() {
        remove();var old=leases.claim(ModerationOutboxConsumer.COLLECTION);assertNotNull(old);
        assertEquals(0,consumer.processBatch());assertEquals(0,count(NotificationInboxEntry.class));
        clock.advance(6);assertEquals(1,consumer.processBatch());assertEquals(3,count(NotificationInboxEntry.class));
        leases.retry(ModerationOutboxConsumer.COLLECTION,old,new IllegalStateException("stale worker"));
        assertEquals("DONE",mongo.getCollection(ModerationOutboxConsumer.COLLECTION).find().first().getString("status"));
    }
    @Test void replayDoesNotResetReadStateAndOwnerCanFetchLinkAfterListingDeletion() throws Exception {
        remove();mongo.remove(Query.query(Criteria.where("_id").is(listing.getId())),Listing.class);consumer.processBatch();
        var view=assertInstanceOf(SellerNotice.class,inbox.list(auth(owner),0,20,false).items().get(0));
        var mvc=MockMvcBuilders.standaloneSetup(new NotificationController(inbox)).build();
        String path=view.link().substring("/api/v1".length());assertFalse(path.contains("/admin/"));assertFalse(path.contains("/staff/"));
        var response=mvc.perform(get(path).principal(auth(owner))).andExpect(status().isOk()).andReturn().getResponse();
        privateFieldsAbsent(response.getContentAsString());assertTrue(response.getContentAsString().contains("Safe seller message"));
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
        mvc.perform(get(path).principal(auth(unrelated))).andExpect(status().isNotFound());
        mvc.perform(patch(path+"/read").principal(auth(owner))).andExpect(status().isOk());
        assertEquals(0,inbox.list(auth(owner),0,20,true).total());
        mongo.updateFirst(new Query(),new Update().set("status","PENDING"),ModerationOutboxConsumer.COLLECTION);
        assertEquals(1,consumer.processBatch());assertEquals(3,count(NotificationInboxEntry.class));
        assertNotNull(entries(owner).get(0).readAt());assertEquals(0,inbox.list(auth(owner),0,20,false).unread());
    }
    private int parallel(Callable<Integer> first,Callable<Integer> second)throws Exception {
        ExecutorService pool=Executors.newFixedThreadPool(2);CountDownLatch start=new CountDownLatch(1);
        try{var a=pool.submit(()->{start.await();return first.call();});var b=pool.submit(()->{start.await();return second.call();});start.countDown();
            return a.get(30,TimeUnit.SECONDS)+b.get(30,TimeUnit.SECONDS);
        }finally{start.countDown();pool.shutdownNow();assertTrue(pool.awaitTermination(10,TimeUnit.SECONDS));}
    }
    @Test void concurrentConsumersAndDeliveryWorkersDoNotDuplicatePersistedNotices()throws Exception {
        remove();var otherLeases=new NotificationLeaseQueue(mongo,clock,1,5);
        var otherConsumer=new ModerationOutboxConsumer(mongo,otherLeases,inbox,50);
        assertEquals(1,parallel(consumer::processBatch,otherConsumer::processBatch));assertEquals(3,count(NotificationInboxEntry.class));
        Queue<String> sent=new ConcurrentLinkedQueue<>();NotificationPublisher publisher=(recipient,view)->sent.add(json(view));
        var a=new NotificationDeliveryWorker(mongo,leases,inbox,publisher,50);
        var b=new NotificationDeliveryWorker(mongo,otherLeases,inbox,publisher,50);
        assertEquals(3,parallel(a::processBatch,b::processBatch));assertEquals(3,sent.size());assertEquals(3,new HashSet<>(sent).size());
    }
    @Test void rolledBackDecisionCannotProduceNotices() {
        MongoTemplate failing=spy(mongo);
        doThrow(new org.springframework.dao.DataAccessResourceFailureException("receipt failed"))
                .when(failing).insert(any(ModerationDecisionReceipt.class));
        denied(503,()->decisions(failing).decide(ModerationDecisionService.Target.CASE,reportCase.id().toHexString(),
                new ModerationDecisionDtos.Request(DecisionAction.REMOVE,0L,"Reason","PRIVATE_STAFF_RATIONALE","Safe"),"failed",auth(staff)));
        assertEquals(0,count(ModerationNotificationEvent.class));assertEquals(0,consumer.processBatch());
        assertEquals(0,count(NotificationInboxEntry.class));assertEquals(Visibility.VISIBLE,listings.findById(listing.getId()).orElseThrow().getModerationVisibility());
    }
}
