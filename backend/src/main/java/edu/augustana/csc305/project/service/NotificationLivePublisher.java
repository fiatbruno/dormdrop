package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.dto.NotificationResponse;
import edu.augustana.csc305.project.repository.UserRepository;
import org.bson.types.ObjectId;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

/** Recipient-specific hint; reconnect recovery always uses the persisted REST inbox. */
@Service
public class NotificationLivePublisher {
    private final UserRepository users;
    private final SimpMessagingTemplate messaging;

    public NotificationLivePublisher(UserRepository users, SimpMessagingTemplate messaging) {
        this.users = users;
        this.messaging = messaging;
    }

    public void publish(ObjectId recipientId, NotificationResponse notification) {
        // STOMP CONNECT uses the persisted user's email as its principal name.
        users.findById(recipientId).ifPresent(user -> messaging.convertAndSendToUser(
                user.getEmail(), "/queue/notifications", notification));
    }
}
