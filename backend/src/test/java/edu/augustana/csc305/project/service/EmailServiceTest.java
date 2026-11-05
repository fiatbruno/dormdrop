package edu.augustana.csc305.project.service;

import org.junit.jupiter.api.Test;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import edu.augustana.csc305.project.config.PublicUrls;
import edu.augustana.csc305.project.controller.AuthController;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EmailServiceTest {
    private static class CapturingMailSender extends JavaMailSenderImpl {
        SimpleMailMessage sent;
        @Override public void send(SimpleMailMessage message) { sent = message; }
    }

    @Test
    void passwordResetLinkUsesConfiguredFrontendAndEncodesToken() {
        var mail = new CapturingMailSender();
        var service = new EmailService(mail, new PublicUrls("https://dormdrop.example.edu/app/", "http://localhost:8080", "/api/v1"));
        service.sendPasswordResetEmail("buyer@example.edu", "a+b&c");
        assertArrayEquals(new String[]{"buyer@example.edu"}, mail.sent.getTo());
        assertTrue(mail.sent.getText().contains("https://dormdrop.example.edu/app/reset-password?token=a%2Bb%26c"));
    }

    @Test
    void verificationEmailUsesConfiguredBackendAndApiPrefix() {
        var mail = new CapturingMailSender();
        var urls = new PublicUrls("https://app.example.edu", "https://api.example.edu/base/", "/api/v2");
        new EmailService(mail, urls).sendVerificationEmail("buyer@example.edu", "a+b&c");
        assertTrue(mail.sent.getText().contains("https://api.example.edu/base/api/v2/auth/verify?token=a%2Bb%26c"));
    }

    @Test
    void verificationRedirectsUseTheConfiguredFrontend() {
        var auth = mock(AuthService.class);
        var urls = new PublicUrls("https://app.example.edu/app", "http://localhost:8080", "/api/v1");
        var controller = new AuthController(null, null, null, auth, urls);
        assertEquals("https://app.example.edu/app/verification-success", controller.verify("good").getHeaders().getLocation().toString());
        doThrow(new IllegalArgumentException("expired")).when(auth).verifyEmail("a+b&c");
        assertEquals("https://app.example.edu/app/verification-expired?token=a%2Bb%26c", controller.verify("a+b&c").getHeaders().getLocation().toString());
    }

    @Test
    void refusesAnUnsafeOrInvalidFrontendUrl() {
        for (String url : new String[]{"", "/app", "javascript:alert(1)",
                "https://user:password@example.edu", "https://example.edu/?next=other"}) {
            assertThrows(IllegalArgumentException.class, () -> new PublicUrls(url, "http://localhost:8080", "/api/v1"));
            assertThrows(IllegalArgumentException.class, () -> new PublicUrls("http://localhost:5173", url, "/api/v1"));
        }
    }
}
