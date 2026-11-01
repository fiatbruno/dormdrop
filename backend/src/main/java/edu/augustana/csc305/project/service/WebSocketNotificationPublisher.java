package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.dto.NotificationDtos.Notice;
import edu.augustana.csc305.project.repository.UserRepository;
import org.bson.types.ObjectId;
import org.springframework.messaging.simp.SimpMessagingTemplate;

public class WebSocketNotificationPublisher implements NotificationPublisher {
    private final UserRepository users;
    private final SimpMessagingTemplate messaging;
    public WebSocketNotificationPublisher(UserRepository users,SimpMessagingTemplate messaging) { this.users=users; this.messaging=messaging; }
    @Override public void publish(ObjectId recipientId,Notice notice) {
        var recipient=users.findById(recipientId).orElseThrow(() -> new IllegalStateException("Notification recipient unavailable."));
        messaging.convertAndSendToUser(recipient.getEmail(),"/queue/notifications",notice);
    }
}
