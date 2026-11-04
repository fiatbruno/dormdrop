package edu.augustana.csc305.project;

import com.mongodb.client.MongoClients;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.model.UserRole;
import edu.augustana.csc305.project.repository.UserRepository;
import edu.augustana.csc305.project.security.StaffAccess;
import edu.augustana.csc305.project.service.AdminDirectoryService;
import java.time.Instant;
import java.util.List;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named = "MODERATION_TEST_MONGODB_URI", matches = ".+")
class AdminDirectoryMongoTest {
    @Test void literalSearchAndPaginationRunAgainstMongoWithoutLeakingSecrets() {
        try (var client = MongoClients.create(System.getenv("MODERATION_TEST_MONGODB_URI"))) {
            var mongo = new MongoTemplate(client, "directory_test_" + new ObjectId().toHexString());
            try {
                var users = new UserRepository(mongo);
                var admin = new User(new ObjectId(), "Admin", "admin@augustana.edu", "hash");
                admin.setRole(UserRole.ADMIN);
                users.storeUser(admin);
                var first = new User(new ObjectId(), "A.* Person", "first@augustana.edu", "password-secret");
                first.setVerificationToken("verification-secret");
                first.setPasswordResetToken("reset-secret");
                users.storeUser(first);
                users.storeUser(new User(new ObjectId(), "A.* Person", "second@augustana.edu", "hash"));
                users.storeUser(new User(new ObjectId(), "Alfred", "alfred@augustana.edu", "hash"));
                var auth = new UsernamePasswordAuthenticationToken(admin.getEmail(), null, List.of());
                var service = new AdminDirectoryService(mongo, new StaffAccess(users));
                var one = service.list(auth, "a.*", 0, 1);
                var two = service.list(auth, "a.*", 1, 1);
                assertEquals(2, one.total());
                assertEquals(2, one.totalPages());
                assertNotEquals(one.items().get(0).id(), two.items().get(0).id());
                assertEquals("***@augustana.edu", one.items().get(0).maskedEmail());
                assertNull(one.items().get(0).createdAt());
                assertEquals(0, service.list(auth, "missing", 0, 20).total());
                assertTrue(service.list(auth, "first@", 0, 20).items().get(0).id().equals(first.getId().toHexString()));
            } finally {
                mongo.getDb().drop();
            }
        }
    }
}
