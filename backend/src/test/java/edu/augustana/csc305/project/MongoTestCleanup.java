package edu.augustana.csc305.project;

import com.mongodb.client.MongoClient;
import java.util.Set;
import java.util.regex.Pattern;

/** Remove only the current fixture's randomly generated namespaces, including indexes.
 * Dropping collections works with read/write test users that cannot drop databases. */
public final class MongoTestCleanup {
    private MongoTestCleanup() {}
    private static final Set<String> PREFIXES = Set.of("dec_test_", "report_test_", "staff_test_",
            "vis_test_", "moderation_test_", "evidence_test_", "search_test_");
    public static void dropCollections(MongoClient client, String database, String prefix) {
        if (client == null || database == null) return;
        if (!PREFIXES.contains(prefix) || !database.matches(Pattern.quote(prefix)+"[0-9a-f]{20,32}"))
            throw new IllegalArgumentException("Cleanup is restricted to generated test databases.");
        for (String name : client.getDatabase(database).listCollectionNames())
            client.getDatabase(database).getCollection(name).drop();
    }
}
