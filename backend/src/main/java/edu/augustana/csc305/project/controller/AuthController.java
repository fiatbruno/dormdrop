package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.dto.SignUpRequest;
import edu.augustana.csc305.project.dto.UserDto;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.UserRepository;
import edu.augustana.csc305.project.security.LoginRequest;
import edu.augustana.csc305.project.security.JwtService;
import edu.augustana.csc305.project.security.LoginResponse;
import edu.augustana.csc305.project.service.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;

/**
 * The controller for handling authentication requests. Defines our /auth routes.
 */
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final AuthService authService;

    public AuthController(UserRepository userRepository, PasswordEncoder passwordEncoder,
                          JwtService jwtService, AuthService authService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.authService = authService;
    }

    /**
     * Login requests contain the email address and password of the user
     * logging in. This endpoint checks the hashed password against the
     * password stored for this user's email.
     *
     * Fails if no user exists with the given email or the password hashes
     * don't match. Otherwise, creates and returns a fresh JWT authentication
     * token.
     */
    @PostMapping("/login")
    public LoginResponse login(@RequestBody LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid email or password");
        }


        if (!user.isEmailVerified()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Please verify your email before logging in."
            );
        }

        String token = jwtService.generateToken(user);
        return new LoginResponse(token, new UserDto(user.getId().toString(), user.getName(), user.getEmail()));
    }

    @PostMapping("/register")
    public UserDto register(@RequestBody SignUpRequest request){
        User user = authService.signUp(request);
        return new UserDto(user.getId().toString(), user.getName(), user.getEmail());
    }

    @GetMapping("/verify")
    public ResponseEntity<Void> verify(@RequestParam String token) {

        try {
            authService.verifyEmail(token);

            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create("http://localhost:5173/verification-success"))
                    .build();

        } catch (IllegalArgumentException e) {

            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(
                            "http://localhost:5173/verification-expired?token=" +
                                    java.net.URLEncoder.encode(
                                            token, java.nio.charset.StandardCharsets.UTF_8
                                    )
                    ))
                    .build();
        }
    }
    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
   public String handleBadRequest(IllegalArgumentException e){
        return e.getMessage();
    }
}
