package edu.augustana.csc305.project.security;

import jakarta.servlet.DispatcherType;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import java.util.List;

/**
 * Spring Boot configuration for user authentication and secured endpoints.
 *
 * You may want to change the call to `authorizeHttpRequests` to suit what
 * endpoints you want to require authentication. (Spring Boot will look from
 * top to bottom in the paths you give until it finds a match, and apply the
 * policy you give. Paths with 'permitAll()' will not require authentication,
 * paths with 'authenticated()' will. The starter code marks all paths as
 * authenticated except for auth/login, all endpoints starting with /public,
 * and the /healthCheck endpoint.
 *
 * Requests prove they are authenticated by sending a JWT token (obtained from
 * auth/login) in their Authorization header. {@link JwtAuthenticationFilter}
 * checks that token on every request.
 */
@Configuration public class SecurityConfig {

    @Bean public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtService jwtService) {
        http
                /*
                 * This piece of configuration controls which endpoints are open and
                 * which require authentication.
                 */
                .authorizeHttpRequests(auth -> auth
                        /*
                         * When a request fails (e.g., a 400 or 500 error), Spring internally
                         * forwards it to an /error page. Allow that forward through, so that
                         * errors are reported properly instead of being turned into an empty
                         * 401 response.
                         */
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers("/api/v1/auth/login").permitAll()
                        .requestMatchers("/api/v1/auth/register").permitAll()
                        .requestMatchers("/api/v1/auth/verify").permitAll()
                        .requestMatchers(
                                "/api/v1/auth/resend-verification"
                        ).permitAll()
                        .requestMatchers("/api/v1/public/**").permitAll()
                        .requestMatchers("/api/v1/healthCheck").permitAll()
                        .anyRequest().authenticated() // All other requests need a token
                )
                /*
                 * Check the JWT token (if any) on every request, before Spring Security
                 * decides whether the request is allowed.
                 */
                .addFilterBefore(new JwtAuthenticationFilter(jwtService),
                        UsernamePasswordAuthenticationFilter.class)
                /*
                 * Respond with 401 Unauthorized when a request needs authentication but
                 * doesn't have a valid token, or when a login attempt fails.
                 */
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                /*
                 * Disable CSRF for the REST API. (CSRF attacks rely on the browser
                 * automatically sending cookies; our tokens are sent in a header instead.)
                 */
                .csrf(csrf -> csrf.disable())
                /*
                 * Normally browsers block cross-origin resource sharing (CORS) for
                 * security reasons, meaning the frontend cannot talk to the backend
                 * if both are running locally. This piece of configuration enables
                 * CORS for API endpoints, letting us run both sides of the application
                 * locally.
                 */
                .cors(cors -> cors.configurationSource(request -> {
                    CorsConfiguration config = new CorsConfiguration();
                    config.setAllowedOrigins(List.of("http://localhost:5173"));
                    config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
                    config.setAllowedHeaders(List.of("*"));
                    return config;
                }))
                /* Stateless session management. */
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        return http.build();
    }

    @Bean public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
