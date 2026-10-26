
package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.dto.SignUpRequest;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.UserRepository;

import org.bson.types.ObjectId;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Optional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    private static final long VERIFICATION_TOKEN_LIFETIME_MS =
            5L * 60 * 1000;

    private static final long PASSWORD_RESET_TOKEN_LIFETIME_MS =
            5L * 60 * 1000;

    private static final SecureRandom RANDOM =
            new SecureRandom();

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            EmailService emailService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
    }

    // Register a new user
    public User signUp(SignUpRequest newRequest) {

        if (newRequest == null ||
                newRequest.getName() == null ||
                newRequest.getEmail() == null ||
                newRequest.getPassword() == null) {
            throw new IllegalArgumentException(
                    "Name, email and password are required."
            );
        }

        String name = newRequest.getName().trim();
        String email = newRequest.getEmail()
                .trim().toLowerCase(java.util.Locale.ROOT);
        String password = newRequest.getPassword();

        if (name.isEmpty()) {
            throw new IllegalArgumentException(
                    "Name field cannot be empty."
            );
        }

        if (!email.endsWith("@augustana.edu")) {
            throw new IllegalArgumentException(
                    "Please use an Augustana College email address."
            );
        }

        if (password.length() < 8) {
            throw new IllegalArgumentException(
                    "Password must be at least 8 characters long."
            );
        }

        if (userRepository.emailExists(email)) {
            throw new IllegalArgumentException(
                    "This email is already associated with an account."
            );
        }

        String passwordHash = passwordEncoder.encode(password);

        User user = new User(
                new ObjectId(),
                name,
                email,
                passwordHash
        );

        user.setEmailVerified(false);

        String verificationToken = generateVerificationToken();

        user.setVerificationToken(verificationToken);

        long expiration = System.currentTimeMillis()
                + VERIFICATION_TOKEN_LIFETIME_MS;

        user.setVerificationTokenExpiration(expiration);

        userRepository.storeUser(user);

        emailService.sendVerificationEmail(
                email,
                verificationToken
        );

        return user;
    }

    // Generate a secure random token
    private String generateVerificationToken() {

        byte[] bytes = new byte[32];

        RANDOM.nextBytes(bytes);

        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(bytes);
    }

    // Verify a user's email
    public void verifyEmail(String token) {

        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException(
                    "Verification token is required."
            );
        }

        User user = userRepository
                .findByVerificationToken(token)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Invalid verification link."
                        )
                );

        if (System.currentTimeMillis() >
                user.getVerificationTokenExpiration()) {

            throw new IllegalArgumentException(
                    "This verification link has expired."
            );
        }

        if (user.isEmailVerified()) {
            throw new IllegalArgumentException(
                    "This email has already been verified."
            );
        }

        userRepository.updateUserVerification(
                user.getId().toHexString(),
                true
        );
    }

    // Resend an email verification link
    public void resendVerificationEmail(String email) {

        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException(
                    "Email is required."
            );
        }

        String normalizedEmail =
                email.trim().toLowerCase(java.util.Locale.ROOT);

        Optional<User> optionalUser =
                userRepository.findByEmail(normalizedEmail);

        if (optionalUser.isEmpty()) {
            return;
        }

        User user = optionalUser.get();

        if (user.isEmailVerified()) {
            return;
        }

        String newToken = generateVerificationToken();

        long expiration = System.currentTimeMillis()
                + VERIFICATION_TOKEN_LIFETIME_MS;

        userRepository.updateVerificationToken(
                user.getId(),
                newToken,
                expiration
        );

        emailService.sendVerificationEmail(
                user.getEmail(),
                newToken
        );
    }

    // Request a password reset link
    public void requestPasswordReset(String email) {

        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException(
                    "Email is required."
            );
        }

        String normalizedEmail =
                email.trim().toLowerCase(java.util.Locale.ROOT);

        Optional<User> optionalUser =
                userRepository.findByEmail(normalizedEmail);

        // Do not reveal whether an account exists
        if (optionalUser.isEmpty()) {
            return;
        }

        User user = optionalUser.get();

        // Only verified users can reset their password
        if (!user.isEmailVerified()) {
            return;
        }

        String token = generateVerificationToken();

        long expiration = System.currentTimeMillis()
                + PASSWORD_RESET_TOKEN_LIFETIME_MS;

        userRepository.savePasswordResetToken(
                user.getId(),
                token,
                expiration
        );

        emailService.sendPasswordResetEmail(
                user.getEmail(),
                token
        );
    }

    // Reset a user's password
    public void resetPassword(String token, String newPassword, String confirmPassword) {
        if (confirmPassword == null || !confirmPassword.equals(newPassword)) {
            throw new IllegalArgumentException("Passwords do not match.");
        }
        resetPassword(token, newPassword);
    }

    public void resetPassword(
            String token,
            String newPassword
    ) {

        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException(
                    "Reset token is required."
            );
        }

        if (newPassword == null ||
                newPassword.isBlank() || newPassword.length() < 12) {
            throw new IllegalArgumentException(
                    "Password must be at least 12 characters long."
            );
        }

        if (newPassword.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) {
            throw new IllegalArgumentException("Password must be at most 72 UTF-8 bytes long.");
        }

        User user = userRepository
                .findByPasswordResetToken(token)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Invalid or expired password reset link."
                        )
                );

        if (System.currentTimeMillis() >=
                user.getPasswordResetTokenExpiration()) {

            throw new IllegalArgumentException(
                    "Invalid or expired password reset link."
            );
        }

        if (passwordEncoder.matches(newPassword, user.getPasswordHash())) {
            throw new IllegalArgumentException(
                    "Your new password must be different from your current password."
            );
        }

        String passwordHash =
                passwordEncoder.encode(newPassword);

        boolean updated =
                userRepository.updatePasswordAndClearResetToken(
                        user.getId(),
                        token,
                        passwordHash,
                        System.currentTimeMillis()
                );

        if (!updated) {
            throw new IllegalArgumentException(
                    "Invalid or expired password reset link."
            );
        }
    }
}
