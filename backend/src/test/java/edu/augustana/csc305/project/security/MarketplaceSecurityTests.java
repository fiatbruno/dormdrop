package edu.augustana.csc305.project.security;

import edu.augustana.csc305.project.repository.UserRepository;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.core.env.MapPropertySource;
import org.springframework.mock.web.MockServletContext;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import java.util.Map;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class MarketplaceSecurityTests {
    private AnnotationConfigWebApplicationContext context;
    private MockMvc mvc;

    @Configuration
    @EnableWebSecurity
    @EnableWebMvc
    @Import(SecurityConfig.class)
    static class TestConfig {
        @Bean JwtService jwtService() { return mock(JwtService.class); }
        @Bean UserRepository userRepository() { return mock(UserRepository.class); }
        @Bean TestEndpoints endpoints() { return new TestEndpoints(); }
    }

    @RestController
    static class TestEndpoints {
        @GetMapping({"/api/v1/home", "/api/v1/home/123", "/api/v1/images/test.jpg",
                "/api/v1/favorites", "/api/v1/auth/login", "/api/v1/auth/register",
                "/api/v1/auth/verify", "/api/v1/auth/resend-verification", "/api/v1/healthCheck"})
        String ok() { return "ok"; }
    }

    @BeforeEach
    void setup() {
        context = new AnnotationConfigWebApplicationContext();
        context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("testJwt", Map.of(
                "app.jwt.secret", "test-only-secret", "app.jwt.expiration", "3600000")));
        context.setServletContext(new MockServletContext());
        context.register(TestConfig.class);
        context.refresh();
        JwtService jwt = context.getBean(JwtService.class);
        when(jwt.parseToken("valid")).thenReturn(Jwts.claims().subject("student@example.edu").build());
        when(jwt.parseToken("invalid")).thenThrow(new JwtException("invalid signature"));
        when(jwt.parseToken("expired")).thenThrow(new ExpiredJwtException(null, null, "expired"));
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .addFilters(context.getBean(FilterChainProxy.class)).build();
    }

    @AfterEach void cleanup() { context.close(); }

    @Test
    void marketplaceRequiresValidJwt() throws Exception {
        for (String path : new String[]{"/api/v1/home", "/api/v1/home/123",
                "/api/v1/images/test.jpg", "/api/v1/favorites"}) {
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
            for (String token : new String[]{"invalid", "expired"}) {
                mvc.perform(get(path).header("Authorization", "Bearer " + token))
                        .andExpect(status().isUnauthorized());
            }
            mvc.perform(get(path).header("Authorization", "Bearer valid"))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void authenticationAndHealthRoutesRemainPublic() throws Exception {
        for (String path : new String[]{"/api/v1/auth/login", "/api/v1/auth/register",
                "/api/v1/auth/verify", "/api/v1/auth/resend-verification", "/api/v1/healthCheck"}) {
            mvc.perform(get(path)).andExpect(status().isOk());
        }
    }
}
