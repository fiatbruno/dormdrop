
package edu.augustana.csc305.project.security;

import jakarta.servlet.DispatcherType;
import edu.augustana.csc305.project.model.UserRole;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;
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

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JwtService jwtService,
            PersistedUserDetailsService users
    ) throws Exception {

        http
                .authorizeHttpRequests(auth -> auth

                        .dispatcherTypeMatchers(
                                DispatcherType.ERROR
                        ).permitAll()

                        .requestMatchers(
                                "/api/v1/auth/login",
                                "/api/v1/auth/register",
                                "/api/v1/auth/verify",
                                "/api/v1/auth/resend-verification",
                                "/api/v1/auth/forgot-password",
                                "/api/v1/auth/reset-password",
                                "/api/v1/public/**",
                                "/api/v1/healthCheck",
                                "/api/v1/ws"
                        ).permitAll()

                        .requestMatchers("/api/v1/admin/team/**", "/api/v1/admin/team")
                        .access(requires(PermissionPolicy.Capability.MANAGE_ROLES))
                        .requestMatchers("/api/v1/admin/settings/**", "/api/v1/admin/settings",
                                "/api/v1/admin/policy/**", "/api/v1/admin/policy")
                        .access(requires(PermissionPolicy.Capability.MANAGE_CAMPUS_POLICY))
                        .requestMatchers("/api/v1/admin/suspensions/**", "/api/v1/admin/suspensions")
                        .access(requires(PermissionPolicy.Capability.MANAGE_SUSPENSIONS))
                        .requestMatchers("/api/v1/admin/appeals/**", "/api/v1/admin/appeals")
                        .access(requires(PermissionPolicy.Capability.DECIDE_APPEALS))
                        .requestMatchers("/api/v1/admin/users/**", "/api/v1/admin/users")
                        .access(requires(PermissionPolicy.Capability.VIEW_MEMBER_DIRECTORY))
                        .requestMatchers("/api/v1/admin/activity/**", "/api/v1/admin/activity")
                        .access(requires(PermissionPolicy.Capability.VIEW_CAMPUS_ACTIVITY))
                        .requestMatchers("/api/v1/admin/**", "/api/v1/staff/**")
                        .access(requires(PermissionPolicy.Capability.REVIEW_REPORTS))
                        .anyRequest().authenticated()
                )

                .addFilterBefore(
                        new JwtAuthenticationFilter(
                                jwtService, users
                        ),
                        UsernamePasswordAuthenticationFilter.class
                )

                .exceptionHandling(exceptions ->
                        exceptions.authenticationEntryPoint(
                                new HttpStatusEntryPoint(
                                        HttpStatus.UNAUTHORIZED
                                )
                        )
                )

                .csrf(csrf -> csrf.disable())

                .cors(cors ->
                        cors.configurationSource(request -> {

                            CorsConfiguration config =
                                    new CorsConfiguration();

                            config.setAllowedOrigins(
                                    List.of(
                                            "http://localhost:5173"
                                    )
                            );

                            config.setAllowedMethods(
                                    List.of(
                                            "GET",
                                            "POST",
                                            "PUT",
                                            "PATCH",
                                            "DELETE",
                                            "OPTIONS"
                                    )
                            );

                            config.setAllowedHeaders(
                                    List.of("*")
                            );

                            return config;
                        })
                )

                .sessionManagement(session ->
                        session.sessionCreationPolicy(
                                SessionCreationPolicy.STATELESS
                        )
                );

        return http.build();
    }

    private static AuthorizationManager<RequestAuthorizationContext> requires(PermissionPolicy.Capability capability) {
        return (authentication, context) -> {
            var auth = authentication.get();
            boolean allowed = auth != null && auth.isAuthenticated() && auth.getAuthorities().stream()
                    .map(authority -> authority.getAuthority())
                    .filter(authority -> authority.startsWith("ROLE_"))
                    .anyMatch(authority -> {
                        try {
                            return PermissionPolicy.permits(UserRole.valueOf(authority.substring(5)), capability);
                        } catch (IllegalArgumentException ignored) {
                            return false;
                        }
                    });
            return new AuthorizationDecision(allowed);
        };
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

}
