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
    private final UserRepository users;
    public StaffAccess(UserRepository users) { this.users = users; }

    public static boolean permits(UserRole role, PermissionPolicy.Capability capability) {
        return PermissionPolicy.permits(role, capability);
    }

    public User require(Authentication auth, PermissionPolicy.Capability capability) {
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
