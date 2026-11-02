package edu.augustana.csc305.project.security;

import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.model.UserRole;
import edu.augustana.csc305.project.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.regex.Pattern;

/** Optional, first-run-only provisioning; it never changes existing accounts. */
@Component
public class AdminSeeder implements ApplicationRunner {
    private static final Pattern CAMPUS_EMAIL = Pattern.compile(
            "^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@augustana\\.edu$");

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final boolean enabled;
    private final String adminName;
    private final String adminEmail;
    private final String adminPassword;

    public AdminSeeder(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            @Value("${project.admin.bootstrap-enabled:false}") boolean enabled,
            @Value("${project.admin.name:Administrator}") String adminName,
            @Value("${project.admin.email:}") String adminEmail,
            @Value("${project.admin.password:}") String adminPassword) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.enabled = enabled;
        this.adminName = adminName;
        this.adminEmail = adminEmail;
        this.adminPassword = adminPassword;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            return;
        }
        String name = adminName == null ? "" : adminName.trim();
        String email = adminEmail == null ? "" : adminEmail.trim().toLowerCase(Locale.ROOT);
        if (name.isEmpty() || !CAMPUS_EMAIL.matcher(email).matches()
                || adminPassword == null || adminPassword.isBlank() || adminPassword.length() < 8) {
            throw new IllegalStateException("Admin bootstrap requires a name, an @augustana.edu email, and a password of at least 8 characters");
        }
        if (userRepository.count() > 0) {
            return;
        }
        User admin = new User(null, name, email, passwordEncoder.encode(adminPassword));
        admin.setRole(UserRole.ADMIN);
        // The operator must complete the normal email verification flow.
        userRepository.storeUser(admin);
    }
}
