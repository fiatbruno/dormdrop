package edu.augustana.csc305.project.security;

import edu.augustana.csc305.project.model.UserRole;
import io.jsonwebtoken.Claims;
import jakarta.servlet.Filter;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.core.env.MapPropertySource;
import java.util.Map;
import org.springframework.mock.web.MockServletContext;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class HttpAuthorizationTest {
    private static AnnotationConfigWebApplicationContext context;
    private static MockMvc mvc;

    @Configuration
    @EnableWebMvc
    @EnableWebSecurity
    @Import(SecurityConfig.class)
    static class TestConfig {
        @Bean JwtService jwtService() { return mock(JwtService.class); }
        @Bean PersistedUserDetailsService persistedUsers() { return mock(PersistedUserDetailsService.class); }
        @Bean Endpoints endpoints() { return new Endpoints(); }
    }

    @RestController
    static class Endpoints {
        @RequestMapping("/**") String endpoint() { return "ok"; }
    }

    @BeforeAll
    static void setup() {
        context = new AnnotationConfigWebApplicationContext();
        context.setServletContext(new MockServletContext());
        context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("test",
                Map.of("app.jwt.secret", "unused", "app.jwt.expiration", "1000")));
        context.register(TestConfig.class);
        context.refresh();
        var jwt = context.getBean(JwtService.class);
        var users = context.getBean(PersistedUserDetailsService.class);
        for (UserRole role : UserRole.values()) {
            Claims claims = mock(Claims.class);
            when(claims.getSubject()).thenReturn(role.name());
            when(jwt.parseToken(role.name())).thenReturn(claims);
            when(users.loadUserByUsername(role.name())).thenReturn(
                    User.withUsername(role.name()).password("hash").roles(role.name()).build());
        }
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .addFilters((Filter) context.getBean("springSecurityFilterChain")).build();
    }

    @AfterAll static void close() { if (context != null) context.close(); }

    @Test
    void publicAndProtectedPathsRespectTheRoleHierarchy() throws Exception {
        mvc.perform(get("/api/v1/public/anything")).andExpect(status().isOk());
        for (String path : new String[]{"/api/v1/admin/reports", "/api/v1/staff/cases"}) {
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
            mvc.perform(get(path).header("Authorization", "Bearer STUDENT")).andExpect(status().isForbidden());
            mvc.perform(get(path).header("Authorization", "Bearer MODERATOR")).andExpect(status().isOk());
            mvc.perform(get(path).header("Authorization", "Bearer ADMIN")).andExpect(status().isOk());
        }
        for (String path : new String[]{"/api/v1/admin/team", "/api/v1/admin/team/member",
                "/api/v1/admin/settings", "/api/v1/admin/policy", "/api/v1/admin/suspensions",
                "/api/v1/admin/appeals", "/api/v1/admin/users", "/api/v1/admin/activity"}) {
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
            mvc.perform(get(path).header("Authorization", "Bearer STUDENT")).andExpect(status().isForbidden());
            mvc.perform(get(path).header("Authorization", "Bearer MODERATOR")).andExpect(status().isForbidden());
            mvc.perform(get(path).header("Authorization", "Bearer ADMIN")).andExpect(status().isOk());
        }
    }

    @Test
    void capabilitySetsAreHierarchicalAndAdminOnlyOperationsAreRestricted() {
        var student = PermissionPolicy.capabilities(UserRole.STUDENT);
        var moderator = PermissionPolicy.capabilities(UserRole.MODERATOR);
        var admin = PermissionPolicy.capabilities(UserRole.ADMIN);
        assertTrue(moderator.containsAll(student));
        assertTrue(admin.containsAll(moderator));
        for (var capability : new PermissionPolicy.Capability[]{PermissionPolicy.Capability.MANAGE_ROLES,
                PermissionPolicy.Capability.MANAGE_CAMPUS_POLICY, PermissionPolicy.Capability.MANAGE_SUSPENSIONS,
                PermissionPolicy.Capability.DECIDE_APPEALS, PermissionPolicy.Capability.VIEW_CAMPUS_ACTIVITY,
                PermissionPolicy.Capability.VIEW_MEMBER_DIRECTORY}) {
            assertFalse(student.contains(capability));
            assertFalse(moderator.contains(capability));
            assertTrue(admin.contains(capability));
        }
    }
}
