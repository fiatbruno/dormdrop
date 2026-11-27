
package edu.augustana.csc305.project.config;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.IndexOptions;
import com.mongodb.client.model.Indexes;
import org.bson.Document;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Component;

@Component
public class CompletedTransactionSchema implements ApplicationRunner {

    private final MongoTemplate mongo;

    public CompletedTransactionSchema(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    @Override
    public void run(ApplicationArguments args) {
        MongoCollection<Document> collection =
                mongo.getCollection("completedTransactions");

        ensureUniqueIndex(collection, "offerId");
        removeObsoleteListingUniqueIndex(collection);
    }

    private void removeObsoleteListingUniqueIndex(
            MongoCollection<Document> collection
    ) {
        String obsoleteIndexName = null;

        for (Document index : collection.listIndexes()) {
            Document keys = index.get("key", Document.class);

            if (keys == null || keys.size() != 1) {
                continue;
            }

            Object direction = keys.get("listingId");

            if (!(direction instanceof Number)
                    || ((Number) direction).intValue() != 1) {
                continue;
            }

            if (Boolean.TRUE.equals(index.getBoolean("unique"))) {
                obsoleteIndexName = index.getString("name");
                break;
            }
        }

        if (obsoleteIndexName != null) {
            collection.dropIndex(obsoleteIndexName);
        }
    }

    private void ensureUniqueIndex(
            MongoCollection<Document> collection,
            String field
    ) {
        for (Document index : collection.listIndexes()) {
            Document keys = index.get("key", Document.class);

            if (keys != null
                    && keys.size() == 1
                    && keys.containsKey(field)
                    && Integer.valueOf(1).equals(
                    ((Number) keys.get(field)).intValue()
            )) {
                if (!Boolean.TRUE.equals(index.getBoolean("unique"))) {
                    throw new IllegalStateException(
                            "Existing index on " + field
                                    + " is not unique. Review the MongoDB indexes."
                    );
                }

                return;
            }
        }

        collection.createIndex(
                Indexes.ascending(field),
                new IndexOptions().unique(true)
        );
    }
}
