package edu.augustana.csc305.project.security;

import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.model.UserRole;
import edu.augustana.csc305.project.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AdminSeederTest {
    private final UserRepository repository = mock(UserRepository.class);
    private final PasswordEncoder encoder = mock(PasswordEncoder.class);

    @Test
    void disabledDoesNothingEvenWithoutCredentials() {
        new AdminSeeder(repository, encoder, false, "", "", "").run(null);
        verifyNoInteractions(repository, encoder);
    }

    @ParameterizedTest
    @CsvSource(value = {
            "Admin||password1", "Admin|admin@example.com|password1",
            "Admin|@augustana.edu|password1", "Admin|a..b@augustana.edu|password1",
            "Admin|admin@augustana.edu|",
            "Admin|admin@augustana.edu|short", "|admin@augustana.edu|password1"
    }, delimiter = '|')
    void invalidConfigurationFailsWithoutWriting(String name, String email, String password) {
        var seeder = new AdminSeeder(repository, encoder, true, name, email, password);
        assertThrows(IllegalStateException.class, () -> seeder.run(null));
        verifyNoInteractions(repository, encoder);
    }

    @Test
    void createsAnUnverifiedAdminWithEncodedPassword() {
        when(encoder.encode("password1")).thenReturn("hash");
        new AdminSeeder(repository, encoder, true, " Admin ", " ADMIN@AUGUSTANA.EDU ", "password1").run(null);
        verify(repository).storeUser(argThat(user ->
                user.getRole() == UserRole.ADMIN && user.getEmail().equals("admin@augustana.edu")
                        && user.getName().equals("Admin") && user.getPasswordHash().equals("hash")
                        && !user.isEmailVerified() && user.getVerificationToken() == null));
    }

    @Test
    void existingUsersAreNeverPromoted() {
        when(repository.count()).thenReturn(1L);
        new AdminSeeder(repository, encoder, true, "Admin", "admin@augustana.edu", "password1").run(null);
        verify(repository, never()).storeUser(any(User.class));
        verifyNoInteractions(encoder);
    }

    @Test
    void repeatedStartupCreatesOnlyOneAccount() {
        when(repository.count()).thenReturn(0L, 1L);
        when(encoder.encode("password1")).thenReturn("hash");
        var seeder = new AdminSeeder(repository, encoder, true, "Admin", "admin@augustana.edu", "password1");
        seeder.run(null);
        seeder.run(null);
        verify(repository, times(1)).storeUser(any(User.class));
    }
}
