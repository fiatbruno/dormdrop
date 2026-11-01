package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.dto.NotificationDtos.*;
import edu.augustana.csc305.project.service.NotificationInboxService;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/me/notifications")
public class NotificationController {
    private final NotificationInboxService inbox;
    public NotificationController(NotificationInboxService inbox) { this.inbox=inbox; }
    @GetMapping public ResponseEntity<InboxPage> list(Authentication auth,@RequestParam(defaultValue="0") int page,
            @RequestParam(defaultValue="20") int size,@RequestParam(defaultValue="false") boolean unreadOnly) {
        return safe(inbox.list(auth,page,size,unreadOnly));
    }
    @GetMapping("/{id}") public ResponseEntity<Notice> get(Authentication auth,@PathVariable String id) { return safe(inbox.get(auth,id)); }
    @PatchMapping("/{id}/read") public ResponseEntity<Notice> read(Authentication auth,@PathVariable String id) { return safe(inbox.read(auth,id)); }
    private <T> ResponseEntity<T> safe(T body) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body); }
}
