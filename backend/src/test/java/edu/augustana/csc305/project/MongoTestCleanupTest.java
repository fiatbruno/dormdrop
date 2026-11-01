package edu.augustana.csc305.project;

import com.mongodb.client.MongoClient;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MongoTestCleanupTest {
    @Test
    void cleanupRejectsApplicationAndNonGeneratedDatabaseNamesBeforeAccessingMongo() {
        MongoClient client = mock(MongoClient.class);
        assertThrows(IllegalArgumentException.class, () -> MongoTestCleanup.dropCollections(client,"dormdrop","dec_test_"));
        assertThrows(IllegalArgumentException.class, () -> MongoTestCleanup.dropCollections(client,"dec_test_production","dec_test_"));
        assertThrows(IllegalArgumentException.class, () -> MongoTestCleanup.dropCollections(client,"app_"+"a".repeat(24),"app_"));
        verifyNoInteractions(client);
    }
}
