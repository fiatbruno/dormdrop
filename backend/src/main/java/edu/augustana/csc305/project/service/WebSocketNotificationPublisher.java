package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.dto.NotificationDtos.Notice;
import edu.augustana.csc305.project.dto.NotificationDtos.SellerNotice;
import edu.augustana.csc305.project.dto.NotificationDtos.ReporterUpdate;
import edu.augustana.csc305.project.dto.NotificationResponse;
import edu.augustana.csc305.project.model.PrivateNotification;
import edu.augustana.csc305.project.repository.UserRepository;
import org.bson.types.ObjectId;
import org.springframework.messaging.simp.SimpMessagingTemplate;

public class WebSocketNotificationPublisher implements NotificationPublisher {
    private final UserRepository users;
    private final SimpMessagingTemplate messaging;
    public WebSocketNotificationPublisher(UserRepository users,SimpMessagingTemplate messaging) { this.users=users; this.messaging=messaging; }
    @Override public void publish(ObjectId recipientId,Notice notice) {
        var recipient=users.findById(recipientId).orElseThrow(() -> new IllegalStateException("Notification recipient unavailable."));
        messaging.convertAndSendToUser(recipient.getEmail(),"/queue/notifications", response(notice));
    }

    /** REST and live delivery use the same recipient-safe contract. */
    public static NotificationResponse response(Notice notice) {
        boolean seller = notice instanceof SellerNotice;
        SellerNotice s = seller ? (SellerNotice) notice : null;
        ReporterUpdate r = seller ? null : (ReporterUpdate) notice;
        var outcome = seller ? s.outcome() : r.outcome();
        var status = switch (outcome) {
            case KEEP -> PrivateNotification.Status.KEPT;
            case HIDE -> PrivateNotification.Status.HIDDEN;
            case REMOVE -> PrivateNotification.Status.REMOVED;
        };
        return new NotificationResponse(seller ? s.id() : r.id(), seller ? PrivateNotification.Type.MODERATION_NOTICE
                : PrivateNotification.Type.REPORT_UPDATE, null, null,
                new PrivateNotification.Payload(seller ? s.message() : r.message(), status, null,
                        seller ? s.reason() : null, seller ? null : r.report(), seller ? s.link() : r.link()),
                seller ? s.createdAt() : r.createdAt(), seller ? s.readAt() : r.readAt());
    }
}
