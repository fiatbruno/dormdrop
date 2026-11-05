package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.service.RelistService;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/home")
public class RelistController {
    private static final Logger log = LoggerFactory.getLogger(RelistController.class);
    private final RelistService service;
    private final SimpMessagingTemplate messaging;

    public RelistController(RelistService service, SimpMessagingTemplate messaging) {
        this.service = service;
        this.messaging = messaging;
    }

    @PostMapping("/{id}/relist")
    public Listing relist(@PathVariable String id, Authentication authentication) {
        if (authentication == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required.");
        if (!ObjectId.isValid(id)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid listing ID.");
        Listing listing = service.relist(new ObjectId(id), authentication.getName());
        try {
            messaging.convertAndSend("/topic/listings", "updated");
        } catch (Exception ex) {
            log.warn("Could not broadcast listing update", ex);
        }
        return listing;
    }
}
