package edu.augustana.csc305.project.config;

import com.mongodb.client.model.IndexOptions;
import com.mongodb.client.model.Indexes;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;

@Component
public class ModerationSchema implements ApplicationRunner {
    private final MongoTemplate mongo;

    public ModerationSchema(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    @Override
    public void run(ApplicationArguments arguments) {
        initialize(mongo);
    }

    public static void initialize(MongoTemplate mongo) {
        // Missing or null legacy fields receive defaults.
        // Lifecycle status is never changed.
        mongo.getCollection("listings").updateMany(new Document("moderationVisibility", null), new Document("$set", new Document("moderationVisibility", "VISIBLE")));

        mongo.getCollection("listings").updateMany(new Document("version", null), new Document("$set", new Document("version", 0L)));

        var cases = mongo.getCollection("moderationCases");

        // Support case records created before referenceNumber was added.
        try (var cursor = cases.find(new Document("referenceNumber", null)).iterator()) {
            while (cursor.hasNext()) {
                Document existing = cursor.next();
                ObjectId id = existing.getObjectId("_id");

                String reference = "RPT-" + id.toHexString().toUpperCase(Locale.ROOT);

                cases.updateOne(new Document("_id", id).append("referenceNumber", null), new Document("$set", new Document("referenceNumber", reference)));
            }
        }

        cases.createIndex(Indexes.ascending("referenceNumber"), new IndexOptions().name("unique_case_reference").unique(true));

        // One active case across BOTH active statuses.
        cases.createIndex(Indexes.ascending("listingId"), new IndexOptions().name("one_active_case_per_listing").unique(true).partialFilterExpression(new Document("status", new Document("$in", List.of("OPEN", "IN_REVIEW")))));

        cases.createIndex(Indexes.compoundIndex(Indexes.ascending("status", "priority"), Indexes.descending("createdAt", "_id")), new IndexOptions().name("staff_case_queue"));

        cases.createIndex(Indexes.compoundIndex(Indexes.ascending("listingId"), Indexes.descending("createdAt", "_id")), new IndexOptions().name("listing_case_history"));

        mongo.getCollection("reports").createIndex(Indexes.compoundIndex(Indexes.ascending("caseId"), Indexes.ascending("reporterId")), new IndexOptions().name("one_reporter_per_case").unique(true));

        mongo.getCollection("reports").createIndex(Indexes.compoundIndex(Indexes.ascending("reporterId"), Indexes.descending("createdAt", "_id")), new IndexOptions().name("own_report_history"));

        mongo.getCollection("listingSnapshots").createIndex(Indexes.ascending("caseId"), new IndexOptions().name("snapshots_by_case"));

        mongo.getCollection("moderationDecisions").createIndex(Indexes.compoundIndex(Indexes.ascending("caseId"), Indexes.descending("createdAt", "_id")), new IndexOptions().name("decisions_by_case"));

        mongo.getCollection("moderationActivity").createIndex(Indexes.compoundIndex(Indexes.ascending("caseId"), Indexes.descending("createdAt", "_id")), new IndexOptions().name("activity_by_case"));
    }
}
