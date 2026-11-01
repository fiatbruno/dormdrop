package edu.augustana.csc305.project.security;

import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/** Case capabilities do not grant directory or unrestricted messaging access. */
@Component
public class StaffAccess {
    public enum Capability { REVIEW_CASES, ASSIGN_CASES, DECIDE_CASES }
    private final UserRepository users;
    public StaffAccess(UserRepository users) { this.users = users; }

    public static boolean permits(UserRole role, Capability capability) {
        return capability != null && (role == UserRole.MODERATOR || role == UserRole.ADMIN);
    }

    public User require(Authentication auth, Capability capability) {
        if (auth == null || !auth.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required.");
        }
        User user = users.findByEmail(auth.getName()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found."));
        if (!permits(user.getRole(), capability)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff capability required.");
        }
        return user;
    }
}
