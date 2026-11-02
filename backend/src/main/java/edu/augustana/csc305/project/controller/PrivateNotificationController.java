package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.dto.NotificationResponse;
import edu.augustana.csc305.project.service.PrivateNotificationService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/me/notifications")
public class PrivateNotificationController {
    private final PrivateNotificationService notifications;

    public PrivateNotificationController(PrivateNotificationService notifications) {
        this.notifications = notifications;
    }

    @GetMapping
    public ResponseEntity<NotificationResponse.Page> list(Authentication authentication,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(notifications.list(authentication, page, size));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<NotificationResponse.UnreadCount> unreadCount(Authentication authentication) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(notifications.unreadCount(authentication));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<NotificationResponse> read(Authentication authentication, @PathVariable String id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(notifications.read(authentication, id));
    }
}
