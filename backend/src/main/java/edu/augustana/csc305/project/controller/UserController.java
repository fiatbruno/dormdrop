
package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.dto.ProfileResponse;
import edu.augustana.csc305.project.dto.UpdateProfileRequest;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.UserRepository;
import org.apache.coyote.Response;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/users")
public class UserController {

    private final UserRepository userRepository;

    public UserController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMyProfile(
            Authentication authentication
    ) {
        if (authentication == null
                || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body("You need to log in to view your profile.");
        }

        Optional<User> optionalUser =
                userRepository.findByEmail(authentication.getName());

        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body("This account is not found.");
        }

        return ResponseEntity.ok(toProfileResponse(optionalUser.get()));
    }

    @PutMapping("/me")
    public ResponseEntity<?> updateMyProfile(
            @RequestBody UpdateProfileRequest request,
            Authentication authentication
    ) {
        if (authentication == null
                || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body("You need to log in to update your profile.");
        }

        if (request.name() == null
                || request.name().isBlank()) {
            return ResponseEntity.badRequest()
                    .body("Display name cannot be empty.");
        }

        String name = request.name().trim();
        String aboutYou = request.aboutYou() == null
                ? ""
                : request.aboutYou().trim();

        if (name.length() > 120) {
            return ResponseEntity.badRequest()
                    .body("Display name cannot exceed 120 characters.");
        }

        if (aboutYou.length() > 500) {
            return ResponseEntity.badRequest()
                    .body("About you cannot exceed 500 characters.");
        }

        Optional<User> optionalUser =
                userRepository.findByEmail(authentication.getName());

        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body("User account not found.");
        }

        User user = optionalUser.get();

        boolean updated = userRepository.updateUserProfile(
                user.getId(),
                name,
                aboutYou
        );

        if (!updated) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body("Could not update the profile.");
        }

        user.setName(name);
        user.setAboutYou(aboutYou);

        return ResponseEntity.ok(toProfileResponse(user));
    }

    private ProfileResponse toProfileResponse(User user) {
        return new ProfileResponse(
                user.getId().toHexString(),
                user.getName(),
                user.getEmail(),
                user.isEmailVerified(),
                "Augustana College",
                user.getAboutYou() == null ? "" : user.getAboutYou()
        );
    }

    @GetMapping("/me")
    public ResponseEntity<ProfileResponse> getMyProfile(
            Authentication authentication){
        String email = authentication.getName();
        return ResponseEntity.ok(
                userService.getProgile(email);
        )
    }
    )
}
