package edu.augustana.csc305.project;

import edu.augustana.csc305.project.controller.AdminDirectoryController;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.model.UserRole;
import edu.augustana.csc305.project.repository.UserRepository;
import edu.augustana.csc305.project.security.StaffAccess;
import edu.augustana.csc305.project.service.AdminDirectoryService;
import edu.augustana.csc305.project.service.AdminDirectoryService.DirectoryUser;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AdminDirectoryTest {
    private final MongoTemplate mongo = mock(MongoTemplate.class);
    private final UserRepository users = mock(UserRepository.class);
    private final User admin = new User(new ObjectId(), "Admin", "admin@augustana.edu", "secret-hash");
    private final AdminDirectoryService service = new AdminDirectoryService(mongo, new StaffAccess(users));
    private final UsernamePasswordAuthenticationToken auth =
            new UsernamePasswordAuthenticationToken(admin.getEmail(), null, List.of());

    AdminDirectoryTest() {
        admin.setRole(UserRole.ADMIN);
        when(users.findByEmail(admin.getEmail())).thenReturn(Optional.of(admin));
    }

    private void assertStatus(int expected, org.junit.jupiter.api.function.Executable action) {
        assertEquals(expected, assertThrows(ResponseStatusException.class, action).getStatusCode().value());
    }

    @Test void accessRequiresAnAdministratorAtTheServiceBoundary() {
        assertStatus(401, () -> service.list(null, null, 0, 20));
        for (UserRole role : List.of(UserRole.STUDENT, UserRole.MODERATOR)) {
            admin.setRole(role);
            assertStatus(403, () -> service.list(auth, null, 0, 20));
        }
        verifyNoInteractions(mongo);
        admin.setRole(UserRole.ADMIN);
        when(mongo.find(any(Query.class), eq(DirectoryUser.class), eq("users"))).thenReturn(List.of());
        assertEquals(0, service.list(auth, null, 0, 20).total());
    }

    @Test void searchIsLiteralBoundedAndPaginationHasStableTies() {
        when(mongo.count(any(Query.class), eq(User.class))).thenReturn(3L);
        when(mongo.find(any(Query.class), eq(DirectoryUser.class), eq("users"))).thenReturn(List.of());
        var page = service.list(auth, "a.*[b]", 1, 2);
        assertEquals(3, page.total());
        assertEquals(2, page.totalPages());
        ArgumentCaptor<Query> find = ArgumentCaptor.forClass(Query.class);
        ArgumentCaptor<Query> count = ArgumentCaptor.forClass(Query.class);
        verify(mongo).find(find.capture(), eq(DirectoryUser.class), eq("users"));
        verify(mongo).count(count.capture(), eq(User.class));
        var query = find.getValue();
        assertEquals(count.getValue().getQueryObject(), query.getQueryObject());
        assertEquals(2, query.getSkip());
        assertEquals(2, query.getLimit());
        assertEquals(List.of("name", "_id"), List.copyOf(query.getSortObject().keySet()));
        @SuppressWarnings("unchecked") var alternatives = (List<Document>) query.getQueryObject().get("$or");
        Pattern literal = (Pattern) alternatives.get(0).get("name");
        assertTrue(literal.matcher("Prefix A.*[B] suffix").find());
        assertFalse(literal.matcher("anything else").find());
        assertFalse(query.getFieldsObject().containsKey("passwordHash"));
        assertFalse(query.getFieldsObject().containsKey("verificationToken"));
        assertStatus(400, () -> service.list(auth, "x".repeat(101), 0, 20));
        assertStatus(400, () -> service.list(auth, "line\nbreak", 0, 20));
        assertStatus(400, () -> service.list(auth, null, -1, 20));
        assertStatus(400, () -> service.list(auth, null, 0, 101));
        assertStatus(400, () -> service.list(auth, null, 0, 0));
    }

    @Test void httpResponseContainsOnlyMaskedDirectoryFieldsAndRealDates() throws Exception {
        var created = Instant.parse("2026-01-01T00:00:00Z");
        when(mongo.count(any(Query.class), eq(User.class))).thenReturn(2L);
        when(mongo.find(any(Query.class), eq(DirectoryUser.class), eq("users"))).thenReturn(List.of(
                new DirectoryUser(new ObjectId(), "Member", "private@augustana.edu", true, null, created, null),
                new DirectoryUser(new ObjectId(), "Legacy", "malformed-address", false, UserRole.ADMIN, null, null)));
        var mvc = MockMvcBuilders.standaloneSetup(new AdminDirectoryController(service)).build();
        mvc.perform(get("/admin/users").principal(auth))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.items[0].maskedEmail").value("***@augustana.edu"))
                .andExpect(jsonPath("$.items[0].role").value("STUDENT"))
                .andExpect(jsonPath("$.items[0].createdAt").value("2026-01-01T00:00:00Z"))
                .andExpect(jsonPath("$.items[0].updatedAt").doesNotExist())
                .andExpect(jsonPath("$.items[1].maskedEmail").doesNotExist())
                .andExpect(jsonPath("$.items[0].email").doesNotExist())
                .andExpect(jsonPath("$.items[0].passwordHash").doesNotExist())
                .andExpect(jsonPath("$.items[0].verificationToken").doesNotExist())
                .andExpect(jsonPath("$.items[0].passwordResetToken").doesNotExist());
    }
}
