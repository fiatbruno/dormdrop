package edu.augustana.csc305.project;

import com.mongodb.client.MongoClients;
import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.*;
import edu.augustana.csc305.project.service.*;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.math.BigDecimal;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfEnvironmentVariable(named = "MODERATION_TEST_MONGODB_URI", matches = ".+")
class ListingEvidenceMongoTest {
    @TempDir Path directory;

    @Test
    void bsonRoundTripRetainsEvidenceAndRetryAfterSourceDeletion() throws Exception {
        String database = "evidence_test_" + new ObjectId().toHexString(); // 38-byte Atlas limit
        try (var client = MongoClients.create(System.getenv("MODERATION_TEST_MONGODB_URI"))) {
            MongoTemplate mongo = new MongoTemplate(client, database);
            try {
                var listings = mock(ListingRepository.class);
                var users = mock(UserRepository.class);
                Listing listing = new Listing();
                listing.setId(new ObjectId());
                listing.setOwnerId(new ObjectId());
                listing.setVersion(0L);
                listing.setTitle("Original");
                listing.setDescription("Original description");
                listing.setCategory("Furniture");
                listing.setPrice(new BigDecimal("25.00"));
                String filename = UUID.randomUUID() + ".jpg";
                byte[] image = {(byte) 255, (byte) 216, (byte) 255, 1};
                Files.write(directory.resolve(filename), image);
                listing.setImageUrl("/api/v1/images/" + filename);
                mongo.insert(listing);
                when(listings.findById(listing.getId())).thenAnswer(call ->
                        Optional.ofNullable(mongo.findById(listing.getId(), Listing.class)));
                when(users.findById(listing.getOwnerId())).thenReturn(Optional.empty());
                ModerationCase reportCase = mongo.insert(ModerationCase.open(listing.getId(), null));
                ObjectId id = new ObjectId();
                Report report = new Report(id, reportCase.id(), listing.getId(), new ObjectId(), id,
                        ModerationTypes.ReportCategory.OTHER, "Review", "stable-request", Instant.now());
                var service = new ListingEvidenceService(mongo, listings, users,
                        new ImageStorageService(directory.toString(), "/api/v1"));
                service.retainAndInsertReport(report, listing.getVersion());
                Files.write(directory.resolve(filename), new byte[]{0});
                Files.delete(directory.resolve(filename));
                mongo.remove(new Query(), Listing.class);
                ListingSnapshot retained = mongo.findById(id, ListingSnapshot.class);
                assertNotNull(retained);
                assertEquals("Original", retained.title());
                assertEquals("Original description", retained.description());
                assertEquals(0, new BigDecimal("25.00").compareTo(retained.price()));
                assertEquals(listing.getOwnerId(), retained.sellerId());
                assertArrayEquals(image, retained.retainedImages().get(0).bytes());
                service.retainAndInsertReport(report, listing.getVersion());
                assertEquals(1, mongo.count(new Query(), Report.class));
                assertEquals(1, mongo.count(new Query(), ListingSnapshot.class));
            } finally {
                // Clean only this run's isolated database, without requiring dropDatabase permission.
                MongoTestCleanup.dropCollections(client,database,"evidence_test_");
            }
        }
    }
}
