package edu.augustana.csc305.project.controller;

import com.mongodb.MongoWriteException;
import edu.augustana.csc305.project.dto.UserDto;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.UserRepository;
import edu.augustana.csc305.project.security.LoginRequest;
import edu.augustana.csc305.project.security.JwtService;
import edu.augustana.csc305.project.security.LoginResponse;
import edu.augustana.csc305.project.security.RegisterRequest;
import org.bson.types.ObjectId;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * The controller for handling authentication requests. Defines our /auth routes.
 */
@RestController
@RequestMapping("/auth")
public class AuthController {

    private static final Pattern CAMPUS_EMAIL =
            Pattern.compile("^[^@\\s]+@[^@\\s.]+(?:\\.[^@\\s.]+)*\\.edu$");

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    public AuthController(UserRepository userRepository, PasswordEncoder passwordEncoder,
                          JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
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
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid email or password");
        }

        String token = jwtService.generateToken(user);
        return new LoginResponse(token, new UserDto(user.getId().toString(), user.getName(), user.getEmail()));
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public UserDto register(@RequestBody RegisterRequest request) {
        if (request == null || request.displayName() == null
                || request.displayName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Display name is required");
        }
        if (request.email() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A valid .edu email is required");
        }

        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (!CAMPUS_EMAIL.matcher(email).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A valid .edu email is required");
        }
        if (request.password() == null || request.password().length() < 8) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Password must be at least 8 characters long");
        }
        if (userRepository.findByEmail(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists");
        }

        User user = new User(
                new ObjectId(),
                request.displayName().trim(),
                email,
                passwordEncoder.encode(request.password()));
        try {
            userRepository.storeUser(user);
        } catch (MongoWriteException exception) {
            if (exception.getError().getCode() == 11000) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT, "An account with this email already exists", exception);
            }
            throw exception;
        }

        return new UserDto(user.getId().toString(), user.getName(), user.getEmail());
    }
}
