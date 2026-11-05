package edu.augustana.csc305.project.config;

import org.springframework.context.annotation.Configuration;
import edu.augustana.csc305.project.security.WebSocketSessions;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import edu.augustana.csc305.project.security.WebSocketAuthInterceptor;
import org.springframework.messaging.simp.config.ChannelRegistration;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig
        implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/api/v1/ws")
                .setAllowedOrigins(frontendOrigin.value());
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/queue", "/topic");
        registry.setUserDestinationPrefix("/user");
    }
    private final WebSocketAuthInterceptor authInterceptor;
    private final WebSocketSessions sessions;
    private final FrontendOrigin frontendOrigin;

    public WebSocketConfig(WebSocketAuthInterceptor authInterceptor, WebSocketSessions sessions,
                           FrontendOrigin frontendOrigin) {
        this.authInterceptor = authInterceptor;
        this.sessions = sessions;
        this.frontendOrigin = frontendOrigin;
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        registration.addDecoratorFactory(sessions);
    }

    @Override
    public void configureClientInboundChannel(
            ChannelRegistration registration
    ) {
        registration.interceptors(authInterceptor);
    }
}
