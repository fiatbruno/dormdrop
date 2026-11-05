
package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.dto.ResendVerificationRequest;
import edu.augustana.csc305.project.dto.ResetPasswordRequest;
import edu.augustana.csc305.project.dto.SignUpRequest;
import edu.augustana.csc305.project.dto.UserDto;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.UserRepository;
import edu.augustana.csc305.project.security.LoginRequest;
import edu.augustana.csc305.project.security.JwtService;
import edu.augustana.csc305.project.security.LoginResponse;
import edu.augustana.csc305.project.service.AuthService;
import edu.augustana.csc305.project.config.PublicUrls;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * The controller for handling authentication requests.
 * Defines our /auth routes.
 */
@RestController
@RequestMapping("/auth")
public class AuthController {
    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final AuthService authService;
    private final PublicUrls urls;

    public AuthController(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AuthService authService,
            PublicUrls urls
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.authService = authService;
        this.urls = urls;
    }

    @PostMapping("/login")
    public LoginResponse login(@RequestBody LoginRequest request) {

        User user = userRepository.findByEmail(
                request.email() == null
                        ? ""
                        : request.email()
                        .trim()
                        .toLowerCase(java.util.Locale.ROOT)
        ).orElseThrow(() ->
                new BadCredentialsException(
                        "Invalid email or password"
                )
        );

        if (request.password() == null ||
                !passwordEncoder.matches(
                        request.password(),
                        user.getPasswordHash()
                )) {
            throw new BadCredentialsException(
                    "Invalid email or password"
            );
        }

        if (!user.isEmailVerified()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Please verify your email before logging in."
            );
        }

        String token = jwtService.generateToken(user);

        try {
            userRepository.recordLogin(user.getId(), Instant.now());
        } catch (RuntimeException ex) {
            log.warn("Could not record sign-in activity", ex);
        }

        return new LoginResponse(
                token,
                new UserDto(
                        user.getId().toString(),
                        user.getName(),
                        user.getEmail()
                )
        );
    }

    @PostMapping("/register")
    public UserDto register(
            @RequestBody SignUpRequest request
    ) {
        User user = authService.signUp(request);

        return new UserDto(
                user.getId().toString(),
                user.getName(),
                user.getEmail()
        );
    }

    @GetMapping("/verify")
    public ResponseEntity<Void> verify(
            @RequestParam String token
    ) {
        try {
            authService.verifyEmail(token);

            return ResponseEntity
                    .status(HttpStatus.FOUND)
                    .location(urls.verificationSuccess())
                    .build();

        } catch (IllegalArgumentException e) {

            return ResponseEntity
                    .status(HttpStatus.FOUND)
                    .location(urls.verificationExpired(token))
                    .build();
        }
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public String handleBadRequest(
            IllegalArgumentException e
    ) {
        return e.getMessage();
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<String> resendVerification(
            @RequestBody ResendVerificationRequest request
    ) {
        authService.resendVerificationEmail(
                request.email()
        );

        return ResponseEntity.ok(
                "If this account requires verification, "
                        + "a new link will be sent."
        );
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(
            @RequestBody Map<String, String> request
    ) {
        String email = request.get("email");

        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(
                    Map.of(
                            "message",
                            "Please enter your email address."
                    )
            );
        }

        authService.requestPasswordReset(email);

        return ResponseEntity.ok(
                Map.of(
                        "message",
                        "If a verified account exists for that email, a password reset link will be sent."
                )
        );
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, Object>> resetPassword(
            @RequestBody ResetPasswordRequest request
    ) {
        try {
            authService.resetPassword(
                    request.token(),
                    request.newPassword(),
                    request.confirmPassword()
            );

            return ResponseEntity.ok(
                    Map.of(
                            "message",
                            "Your password has been reset successfully.",
                            "success", true
                    )
            );

        } catch (IllegalArgumentException e) {

            return ResponseEntity.badRequest().body(
                    Map.of(
                            "message",
                            e.getMessage(),
                            "success", false
                    )
            );
        }
    }
}
