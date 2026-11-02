package edu.augustana.csc305.project;

import com.mongodb.client.*;
import edu.augustana.csc305.project.config.ModerationSchema;
import edu.augustana.csc305.project.controller.ImageController;
import edu.augustana.csc305.project.dto.CreateListingRequest;
import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.*;
import edu.augustana.csc305.project.service.*;
import org.bson.Document;
import org.bson.types.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.data.mongodb.repository.support.MongoRepositoryFactory;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.nio.file.*;
import java.util.*;

import static edu.augustana.csc305.project.model.ModerationTypes.Visibility.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfEnvironmentVariable(named="MODERATION_TEST_MONGODB_URI", matches=".+")
class VisibilityMongoTest {
    @TempDir Path uploads;
    private MongoClient client;
    private MongoTemplate mongo;
    private String database;
    private ListingRepository listings;
    private UserRepository users;
    private User owner;
    private ListingService service;
    private final ListingVisibilityPolicy policy = new ListingVisibilityPolicy();
    private final CreateListingRequest edit = new CreateListingRequest("Edited", "Changed", "Furniture",
            new BigDecimal("5.00"), "Good", "Campus", "For sale");

    @BeforeEach
    void connect() {
        database = "vis_test_"+new ObjectId();
        client = MongoClients.create(System.getenv("MODERATION_TEST_MONGODB_URI"));
        mongo = new MongoTemplate(client,database);
        ModerationSchema.initialize(mongo);
        listings = new MongoRepositoryFactory(mongo).getRepository(ListingRepository.class);
        users = new UserRepository(mongo);
        owner = new User(new ObjectId(),"Owner","owner@augustana.edu","hash");
        users.storeUser(owner);
        service = new ListingService(listings,users,mongo,policy);
    }
    @AfterEach
    void cleanup() {
        if (client == null) return;
        try {
            if (database != null && database.startsWith("vis_test_"))
                for (String name : client.getDatabase(database).listCollectionNames())
                    client.getDatabase(database).getCollection(name).deleteMany(new Document());
        } finally { client.close(); }
    }
    private Listing listing(ModerationTypes.Visibility visibility) throws Exception {
        Listing listing = new Listing(); listing.setId(new ObjectId()); listing.setOwnerId(owner.getId());
        listing.setTitle("Original"); listing.setDescription("Original text"); listing.setCategory("Furniture");
        listing.setPrice(new BigDecimal("12.50")); listing.setModerationVisibility(visibility);
        String filename = UUID.randomUUID()+".jpg";
        Files.write(uploads.resolve(filename),new byte[]{(byte)255,(byte)216,(byte)255,1});
        listing.setImageUrl("/api/v1/images/"+filename);
        return listings.insert(listing);
    }
    private ImageController images() {
        return new ImageController(new ImageStorageService(uploads.toString(),"/api/v1"),listings,users,policy);
    }
    private void denied(int status, org.junit.jupiter.api.function.Executable action) {
        assertEquals(status,assertThrows(ResponseStatusException.class,action).getStatusCode().value());
    }

    @Test
    void mongoBrowseCriteriaIncludesLegacyAndExcludesRestricted() throws Exception {
        Listing visible = listing(VISIBLE); listing(HIDDEN); listing(REMOVED);
        ObjectId legacy = new ObjectId();
        mongo.getCollection("listings").insertOne(new Document("_id",legacy).append("title","Legacy")
                .append("status","DONATED").append("ownerId",owner.getId()));
        var browse = service.getListings(null,null,null,null,null,null,null,null);
        assertEquals(Set.of(visible.getId(),legacy),new HashSet<>(browse.stream().map(Listing::getId).toList()));
        ModerationSchema.initialize(mongo); ModerationSchema.initialize(mongo);
        assertEquals("DONATED",mongo.getCollection("listings").find(new Document("_id",legacy)).first().getString("status"));
    }

    @Test
    void retainedBytesAndReportSurviveSellerEditsReplacementStatusAndDeletion() throws Exception {
        Listing listing = listing(VISIBLE);
        ObjectId snapshot = new ObjectId();
        ObjectId report = new ObjectId();
        mongo.getCollection("listingSnapshots").insertOne(new Document("_id",snapshot).append("listingId",listing.getId())
                .append("title","Retained original").append("price",new Decimal128(new BigDecimal("12.50")))
                .append("privateImageBytes",new Binary(new byte[]{1,2,3,4})));
        mongo.getCollection("reports").insertOne(new Document("_id",report).append("snapshotId",snapshot));
        Document retained = mongo.getCollection("listingSnapshots").find(new Document("_id",snapshot)).first();
        service.updateListing(listing.getId(),edit,owner.getEmail());
        service.updateStatus(listing.getId(),ListingStatus.SOLD,owner.getEmail());
        denied(409,() -> service.updateStatus(listing.getId(),ListingStatus.AVAILABLE,owner.getEmail()));
        String oldFilename = listing.getImageUrl().substring("/api/v1/images/".length());
        images().uploadImage(listing.getId().toHexString(),new MockMultipartFile("file","new.jpg","image/jpeg",
                new byte[]{(byte)255,(byte)216,(byte)255,2}),
                new UsernamePasswordAuthenticationToken(owner.getEmail(),null,List.of()));
        denied(404,() -> images().getImage(oldFilename));
        assertEquals(ListingStatus.SOLD,listings.findById(listing.getId()).orElseThrow().getStatus());
        service.deleteListing(listing.getId(),owner.getEmail());
        assertEquals(retained,mongo.getCollection("listingSnapshots").find(new Document("_id",snapshot)).first());
        assertNotNull(mongo.getCollection("reports").find(new Document("_id",report)).first());
        denied(404,() -> images().getImage(UUID.randomUUID()+".jpg"));
    }

    @Test
    void moderationRacePreventsSellerSaveFromRestoringRemoval() throws Exception {
        Listing listing = listing(VISIBLE);
        ListingRepository racing = mock(ListingRepository.class);
        when(racing.findById(listing.getId())).thenAnswer(call -> listings.findById(listing.getId()));
        when(racing.save(any(Listing.class))).thenAnswer(call -> {
            mongo.updateFirst(Query.query(Criteria.where("_id").is(listing.getId())),
                    new Update().set("moderationVisibility",REMOVED).inc("version",1L),Listing.class);
            return listings.save(call.getArgument(0));
        });
        var racingService = new ListingService(racing,users,mongo,policy);
        assertThrows(org.springframework.dao.OptimisticLockingFailureException.class,
                () -> racingService.updateListing(listing.getId(),edit,owner.getEmail()));
        Listing retained = listings.findById(listing.getId()).orElseThrow();
        assertEquals(REMOVED,retained.getModerationVisibility()); assertEquals("Original",retained.getTitle());
        denied(409,() -> service.deleteListing(listing.getId(),owner.getEmail()));
    }

    @Test
    void alternateDeletePathUsesVisibilityAndVersionFence() throws Exception {
        Listing listing = listing(VISIBLE);
        MongoTemplate racing = spy(mongo);
        doAnswer(call -> {
            mongo.updateFirst(Query.query(Criteria.where("_id").is(listing.getId())),
                    new Update().set("moderationVisibility",REMOVED).inc("version",1L),Listing.class);
            return mongo.remove((Query)call.getArgument(0),Listing.class);
        }).when(racing).remove(any(Query.class),eq(Listing.class));
        var mine = new MyListingsService(racing,users,policy);
        denied(409,() -> mine.deleteMyListing(listing.getId().toHexString(),owner.getEmail()));
        assertEquals(REMOVED,listings.findById(listing.getId()).orElseThrow().getModerationVisibility());
    }
}
