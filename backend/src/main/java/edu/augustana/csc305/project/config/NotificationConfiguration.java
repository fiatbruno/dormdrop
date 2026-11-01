package edu.augustana.csc305.project.config;

import org.springframework.context.annotation.*;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import edu.augustana.csc305.project.repository.UserRepository;
import edu.augustana.csc305.project.service.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import java.time.Clock;

@Configuration
@EnableScheduling
public class NotificationConfiguration {
    @Bean("notificationClock")
    public Clock notificationClock() { return Clock.systemUTC(); }
    /** #58 can supply its transport adapter without changing moderation projection or retry behavior. */
    @Bean
    @ConditionalOnMissingBean(NotificationPublisher.class)
    public NotificationPublisher notificationPublisher(UserRepository users,SimpMessagingTemplate messaging) {
        return new WebSocketNotificationPublisher(users,messaging);
    }
}
