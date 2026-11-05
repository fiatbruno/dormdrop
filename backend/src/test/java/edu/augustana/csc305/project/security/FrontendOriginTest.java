package edu.augustana.csc305.project.security;

import edu.augustana.csc305.project.config.FrontendOrigin;
import edu.augustana.csc305.project.config.WebSocketConfig;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.cors.DefaultCorsProcessor;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.StompWebSocketEndpointRegistration;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class FrontendOriginTest {
    @Test
    void derivesBrowserOriginsFromConfiguredFrontendUrl() {
        assertEquals("http://localhost:5173", new FrontendOrigin("http://localhost:5173").value());
        assertEquals("https://app.example.edu", new FrontendOrigin("https://APP.example.edu:443/dormdrop/").value());
        assertEquals("https://app.example.edu:8443", new FrontendOrigin("https://app.example.edu:8443/path").value());
        for (String invalid : new String[]{"*", "file:///tmp/app", "https://user:pass@app.example.edu", "https://app.example.edu/?token=x", "https://app.example.edu/#frag"}) {
            assertThrows(IllegalArgumentException.class, () -> new FrontendOrigin(invalid));
        }
    }

    @Test
    void configuredOriginPassesPreflightAndOtherOriginsAreDenied() throws Exception {
        var source = new SecurityConfig().corsConfigurationSource(new FrontendOrigin("https://app.example.edu/path"));
        var processor = new DefaultCorsProcessor();
        var allowed = preflight("https://app.example.edu");
        var allowedResponse = new MockHttpServletResponse();
        assertTrue(processor.processRequest(source.getCorsConfiguration(allowed), allowed, allowedResponse));
        assertEquals("https://app.example.edu", allowedResponse.getHeader("Access-Control-Allow-Origin"));
        var denied = preflight("https://other.example.edu");
        var deniedResponse = new MockHttpServletResponse();
        assertFalse(processor.processRequest(source.getCorsConfiguration(denied), denied, deniedResponse));
        assertEquals(403, deniedResponse.getStatus());
    }

    @Test
    void websocketUsesTheSameConfiguredOrigin() {
        var registry = mock(StompEndpointRegistry.class);
        var endpoint = mock(StompWebSocketEndpointRegistration.class);
        when(registry.addEndpoint("/api/v1/ws")).thenReturn(endpoint);
        new WebSocketConfig(mock(WebSocketAuthInterceptor.class), mock(WebSocketSessions.class),
                new FrontendOrigin("https://app.example.edu/dormdrop")).registerStompEndpoints(registry);
        verify(endpoint).setAllowedOrigins("https://app.example.edu");
    }

    private MockHttpServletRequest preflight(String origin) {
        var request = new MockHttpServletRequest("OPTIONS", "/api/v1/home");
        request.addHeader("Origin", origin);
        request.addHeader("Access-Control-Request-Method", "POST");
        request.addHeader("Access-Control-Request-Headers", "authorization,content-type");
        return request;
    }
}
