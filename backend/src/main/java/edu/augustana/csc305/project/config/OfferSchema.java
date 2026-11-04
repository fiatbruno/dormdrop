package edu.augustana.csc305.project.config;

import com.mongodb.client.model.IndexOptions;
import com.mongodb.client.model.Indexes;
import org.bson.Document;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Component;

/** Indexes for negotiations; duplicate pending offers are rejected by MongoDB across instances. */
@Component
public class OfferSchema implements ApplicationRunner {
    private final MongoTemplate mongo;
    public OfferSchema(MongoTemplate mongo) { this.mongo = mongo; }
    @Override public void run(ApplicationArguments args) { initialize(mongo); }

    public static void initialize(MongoTemplate mongo) {
        // Create the ledger outside transactions, including on an empty database.
        mongo.getCollection("offerDecisionRequests").createIndex(Indexes.ascending("createdAt"),
                new IndexOptions().name("offer_decision_request_history"));
        mongo.getCollection("offerCounterRequests").createIndex(Indexes.ascending("createdAt"),
                new IndexOptions().name("offer_counter_request_history"));
        var offers = mongo.getCollection("offerNegotiations");
        offers.createIndex(Indexes.ascending("buyerId", "listingId"), new IndexOptions()
                .name("one_pending_offer_per_buyer_listing").unique(true)
                .partialFilterExpression(new Document("status", "PENDING")));
        offers.createIndex(Indexes.compoundIndex(Indexes.ascending("buyerId"), Indexes.descending("createdAt", "_id")),
                new IndexOptions().name("offers_by_buyer"));
        offers.createIndex(Indexes.compoundIndex(Indexes.ascending("sellerId"), Indexes.descending("createdAt", "_id")),
                new IndexOptions().name("offers_by_seller"));
    }
}
