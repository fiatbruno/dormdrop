package edu.augustana.csc305.project;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import edu.augustana.csc305.project.config.ReportTransactionConfig;
import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.UserRepository;
import edu.augustana.csc305.project.security.*;
import edu.augustana.csc305.project.service.TeamRoleService;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfEnvironmentVariable(named="MODERATION_TEST_MONGODB_URI", matches=".+")
class TeamRoleMongoTest {
    private MongoClient client;
    private MongoTemplate mongo;
    private UserRepository users;
    private TeamRoleService roles;
    private WebSocketSessions sockets;
    @BeforeEach void setup() {
        client = MongoClients.create(System.getenv("MODERATION_TEST_MONGODB_URI"));
        mongo = new MongoTemplate(client, "role_test_" + new ObjectId().toHexString());
        users = new UserRepository(mongo);
        sockets = mock(WebSocketSessions.class);
        roles = new TeamRoleService(mongo, new ReportTransactionConfig().reportTransactions(mongo.getMongoDatabaseFactory()),
                new StaffAccess(users), sockets);
    }
    @AfterEach void cleanup() { mongo.getDb().drop(); client.close(); }
    private User create(UserRole role) {
        User user = new User(new ObjectId(), "Name", new ObjectId().toHexString() + "@augustana.edu", "hash");
        user.setEmailVerified(true); user.setRole(role); users.storeUser(user); return user;
    }
    private UsernamePasswordAuthenticationToken auth(User user) {
        return new UsernamePasswordAuthenticationToken(user.getEmail(), null, List.of());
    }
    @Test void concurrentSelfDemotionsKeepAnAdministratorAndAuditOnlySuccess() throws Exception {
        User a = create(UserRole.ADMIN), b = create(UserRole.ADMIN);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<Boolean>> results = List.of(a, b).stream().map(user -> pool.submit(() -> {
                start.await();
                try { roles.changeRole(auth(user), user.getId().toHexString(), UserRole.STUDENT); return true; }
                catch (ResponseStatusException error) { assertEquals(409, error.getStatusCode().value()); return false; }
            })).toList();
            start.countDown();
            int successes = 0;
            for (var result : results) if (result.get(30, TimeUnit.SECONDS)) successes++;
            assertEquals(1, successes);
            assertEquals(1, mongo.count(Query.query(Criteria.where("role").is(UserRole.ADMIN)), User.class));
            assertEquals(1, mongo.count(new Query(), RoleChange.class));
            verify(sockets, times(1)).disconnectUser(any());
        } finally { pool.shutdownNow(); }
    }
    @Test void auditWriteFailureRollsBackRoleAndDoesNotDisconnect() {
        User admin = create(UserRole.ADMIN), student = create(UserRole.STUDENT);
        mongo.getDb().createCollection("role_changes", new com.mongodb.client.model.CreateCollectionOptions()
                .validationOptions(new com.mongodb.client.model.ValidationOptions()
                        .validator(new org.bson.Document("impossible", new org.bson.Document("$exists", true)))));
        assertThrows(ResponseStatusException.class,
                () -> roles.changeRole(auth(admin), student.getId().toHexString(), UserRole.MODERATOR));
        assertEquals(UserRole.STUDENT, users.findById(student.getId()).orElseThrow().getRole());
        assertEquals(0, mongo.count(new Query(), RoleChange.class));
        verifyNoInteractions(sockets);
    }
    @Test void eligibilityAndAccessFailuresDoNotWriteAudit() {
        User admin = create(UserRole.ADMIN), student = create(UserRole.STUDENT);
        student.setEmailVerified(false); mongo.save(student);
        assertEquals(400, assertThrows(ResponseStatusException.class,
                () -> roles.changeRole(auth(admin), student.getId().toHexString(), UserRole.MODERATOR)).getStatusCode().value());
        assertEquals(403, assertThrows(ResponseStatusException.class,
                () -> roles.changeRole(auth(student), admin.getId().toHexString(), UserRole.STUDENT)).getStatusCode().value());
        assertEquals(0, mongo.count(new Query(), RoleChange.class));
        verifyNoInteractions(sockets);
    }
}
