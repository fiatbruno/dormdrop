package edu.augustana.csc305.project;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import edu.augustana.csc305.project.config.OfferSchema;
import edu.augustana.csc305.project.model.OfferNegotiation;
import org.bson.Document;
import org.bson.types.Decimal128;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.mongodb.core.MongoTemplate;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named = "MODERATION_TEST_MONGODB_URI", matches = ".+")
class OfferNegotiationMongoTest {
    private MongoClient client;
    private MongoTemplate mongo;
    @BeforeEach void setup() {
        client = MongoClients.create(System.getenv("MODERATION_TEST_MONGODB_URI"));
        mongo = new MongoTemplate(client, "offer_test_" + new ObjectId().toHexString());
        OfferSchema.initialize(mongo);
        OfferSchema.initialize(mongo);
    }
    @AfterEach void cleanup() { mongo.getDb().drop(); client.close(); }

    @Test void mapsExactDecimalAmountsAndUtcInstants() {
        var now = Instant.parse("2026-10-21T13:14:15.123Z");
        var offer = OfferNegotiation.create(new ObjectId(), new ObjectId(), new ObjectId(), new BigDecimal("0.01"), now);
        offer = offer.counter(offer.sellerId(), new BigDecimal("19.99"), 0, now.plusSeconds(1));
        mongo.insert(offer);
        var loaded = mongo.findById(offer.id(), OfferNegotiation.class);
        assertNotNull(loaded);
        assertEquals(new BigDecimal("19.99"), loaded.amount());
        assertEquals(new BigDecimal("0.01"), loaded.history().get(0).amount());
        assertEquals(now, loaded.createdAt());
        assertEquals(now.plusSeconds(1), loaded.updatedAt());
        Document raw = mongo.getCollection("offerNegotiations").find(new Document("_id", offer.id())).first();
        assertInstanceOf(Decimal128.class, raw.get("amount"));
    }

    @Test void concurrentInsertsAllowOnlyOnePendingPerBuyerAndListing() throws Exception {
        ObjectId buyer = new ObjectId(), seller = new ObjectId(), listing = new ObjectId();
        var gate = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Callable<Boolean> insert = () -> {
                gate.await();
                try {
                    mongo.insert(OfferNegotiation.create(listing, buyer, seller, BigDecimal.ONE, Instant.now()));
                    return true;
                } catch (org.springframework.dao.DuplicateKeyException expected) { return false; }
            };
            var a = executor.submit(insert);
            var b = executor.submit(insert);
            gate.countDown();
            assertNotEquals(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS));
            assertEquals(1, mongo.getCollection("offerNegotiations").countDocuments());
            var accepted = mongo.findAll(OfferNegotiation.class).get(0)
                    .decide(seller, OfferNegotiation.Status.ACCEPTED, 0, Instant.now());
            mongo.save(accepted);
            assertDoesNotThrow(() -> mongo.insert(OfferNegotiation.create(listing, buyer, seller, BigDecimal.ONE, Instant.now())));
        } finally { executor.shutdownNow(); }
    }
}
