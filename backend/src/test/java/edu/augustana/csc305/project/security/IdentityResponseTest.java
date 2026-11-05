package edu.augustana.csc305.project.security;

import edu.augustana.csc305.project.controller.AuthController;
import edu.augustana.csc305.project.controller.UserController;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.model.UserRole;
import edu.augustana.csc305.project.repository.UserRepository;
import edu.augustana.csc305.project.service.AuthService;
import edu.augustana.csc305.project.service.EmailService;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class IdentityResponseTest {
    private final UserRepository users = mock(UserRepository.class);
    private final User user = new User(new ObjectId(), "Student", "student@augustana.edu", "secret-hash");

    @Test
    void currentUserIsSafeAndReflectsPersistedRoleChanges() throws Exception {
        user.setVerificationToken("verification-secret");
        user.setPasswordResetToken("reset-secret");
        when(users.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        var mvc = MockMvcBuilders.standaloneSetup(new UserController(users)).build();
        var principal = new UsernamePasswordAuthenticationToken(user.getEmail(), null, List.of());

        mvc.perform(get("/users/me")).andExpect(status().isUnauthorized());
        for (var role : UserRole.values()) {
            user.setRole(role);
            var expected = PermissionPolicy.capabilities(role).stream().sorted().map(Enum::name).toArray();
            mvc.perform(get("/users/me").principal(principal))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(user.getId().toHexString()))
                    .andExpect(jsonPath("$.name").value(user.getName()))
                    .andExpect(jsonPath("$.email").value(user.getEmail()))
                    .andExpect(jsonPath("$.emailVerified").value(false))
                    .andExpect(jsonPath("$.campus").value("Augustana College"))
                    .andExpect(jsonPath("$.aboutYou").value(""))
                    .andExpect(jsonPath("$.role").value(role.name()))
                    .andExpect(jsonPath("$.capabilities").isArray())
                    .andExpect(jsonPath("$.capabilities.length()").value(expected.length))
                    .andExpect(jsonPath("$.passwordHash").doesNotExist())
                    .andExpect(jsonPath("$.verificationToken").doesNotExist())
                    .andExpect(jsonPath("$.verificationTokenExpiration").doesNotExist())
                    .andExpect(jsonPath("$.passwordResetToken").doesNotExist())
                    .andExpect(jsonPath("$.passwordResetTokenExpiration").doesNotExist())
                    .andExpect(jsonPath("$.internalNotes").doesNotExist());
            for (int i = 0; i < expected.length; i++) {
                mvc.perform(get("/users/me").principal(principal))
                        .andExpect(jsonPath("$.capabilities[" + i + "]").value(expected[i]));
            }
        }
    }

    @Test
    void publicRegistrationIgnoresAttemptedStaffRoles() throws Exception {
        var encoder = mock(PasswordEncoder.class);
        when(encoder.encode(anyString())).thenReturn("encoded");
        var auth = new AuthService(users, encoder, mock(EmailService.class));
        var mvc = MockMvcBuilders.standaloneSetup(new AuthController(users, encoder, mock(JwtService.class), auth,
                new edu.augustana.csc305.project.config.PublicUrls("http://localhost:5173", "http://localhost:8080", "/api/v1"))).build();
        for (String role : List.of("ADMIN", "MODERATOR")) {
            mvc.perform(post("/auth/register").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Student\",\"email\":\"student@augustana.edu\",\"password\":\"password123\",\"role\":\"" + role + "\"}"))
                    .andExpect(status().isOk());
        }
        verify(users, times(2)).storeUser(argThat(value -> value.getRole() == UserRole.STUDENT));
    }
}
