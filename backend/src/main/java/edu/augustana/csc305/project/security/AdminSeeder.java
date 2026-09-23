package edu.augustana.csc305.project.security;

import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Runs once each time the server starts, adding a default
 * admin user if no users are in the database yet.
 *
 * Once your application supports registering new users, you
 * may want to remove this.
 *
 * If you want to keep this behavior, you should set your own
 * admin username and password by setting ADMIN_EMAIL and
 * ADMIN_PASSWORD environment variables.
 */
@Component public class AdminSeeder implements ApplicationRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final String adminName;
    private final String adminEmail;
    private final String adminPassword;

    public AdminSeeder(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            @Value("${project.admin.name}") String adminName,
            @Value("${project.admin.email}") String adminEmail,
            @Value("${project.admin.password}") String adminPassword) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.adminName = adminName;
        this.adminEmail = adminEmail;
        this.adminPassword = adminPassword;
    }

    @Override public void run(ApplicationArguments args) {
        if (userRepository.count() > 0) {
            return;
        }
        User admin = new User(null, adminName, adminEmail, passwordEncoder.encode(adminPassword));
        userRepository.storeUser(admin);
    }
}
