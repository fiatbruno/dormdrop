package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.UserRepository;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PasswordResetTest {
    private final UserRepository repository = mock(UserRepository.class);
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final AuthService service = new AuthService(repository, encoder, mock(EmailService.class));
    private static final String PASSWORD = "new-password-123";

    private User user(long expiration) {
        User user = new User(new ObjectId(), "Student", "student@augustana.edu", "old-hash");
        user.setPasswordResetTokenExpiration(expiration);
        when(repository.findByPasswordResetToken("token")).thenReturn(Optional.of(user));
        return user;
    }

    @Test
    void storesHashedPasswordAndConsumesToken() {
        User user = user(System.currentTimeMillis() + 60000);
        when(repository.updatePasswordAndClearResetToken(eq(user.getId()), eq("token"), anyString(), anyLong()))
                .thenAnswer(call -> {
                    assertTrue(encoder.matches(PASSWORD, call.getArgument(2)));
                    return true;
                });
        service.resetPassword("token", PASSWORD, PASSWORD);
        verify(repository).updatePasswordAndClearResetToken(eq(user.getId()), eq("token"), anyString(), anyLong());
    }

    @Test
    void rejectsMismatchAndShortPasswordBeforeDatabaseAccess() {
        assertThrows(IllegalArgumentException.class, () -> service.resetPassword("token", PASSWORD, "different"));
        assertThrows(IllegalArgumentException.class, () -> service.resetPassword("token", "short", "short"));
        verifyNoInteractions(repository);
    }

    @Test
    void rejectsExpiredAndUnknownTokens() {
        user(System.currentTimeMillis() - 1);
        assertThrows(IllegalArgumentException.class, () -> service.resetPassword("token", PASSWORD, PASSWORD));
        when(repository.findByPasswordResetToken("unknown")).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class, () -> service.resetPassword("unknown", PASSWORD, PASSWORD));
        verify(repository, never()).updatePasswordAndClearResetToken(any(), anyString(), anyString(), anyLong());
    }

    @Test
    void rejectsTokenConsumedByAnotherRequest() {
        user(System.currentTimeMillis() + 60000);
        assertThrows(IllegalArgumentException.class, () -> service.resetPassword("token", PASSWORD, PASSWORD));
    }
}
