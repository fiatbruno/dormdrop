package edu.augustana.csc305.project.security;

import edu.augustana.csc305.project.repository.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/** Resolves current authorities from storage rather than trusting token claims. */
@Service
public class PersistedUserDetailsService implements UserDetailsService {
    private final UserRepository users;

    public PersistedUserDetailsService(UserRepository users) {
        this.users = users;
    }

    public static class VersionedUserDetails extends org.springframework.security.core.userdetails.User {
        private final org.bson.types.ObjectId id;
        private final long roleVersion;
        VersionedUserDetails(edu.augustana.csc305.project.model.User user) {
            super(user.getEmail(), user.getPasswordHash(),
                    java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
            this.id = user.getId();
            this.roleVersion = user.getRoleVersion();
        }
        public org.bson.types.ObjectId id() { return id; }
        public long roleVersion() { return roleVersion; }
    }

    @Override
    public UserDetails loadUserByUsername(String email) {
        if (email == null || email.isBlank()) {
            throw new UsernameNotFoundException("Missing token subject");
        }
        var user = users.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        return new VersionedUserDetails(user);
    }
}
