
package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.dto.CreateListingRequest;
import edu.augustana.csc305.project.dto.ListingDetailsResponse;
import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.model.ListingStatus;
import edu.augustana.csc305.project.service.ListingService;

import jakarta.validation.Valid;
import org.bson.types.ObjectId;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/home")
public class ListingController {

    private static final Logger log = LoggerFactory.getLogger(ListingController.class);
    private final ListingService service;
    private final SimpMessagingTemplate messaging;

    public ListingController(ListingService service) {
        this(service, null);
    }

    @Autowired
    public ListingController(ListingService service, SimpMessagingTemplate messaging) {
        this.service = service;
        this.messaging = messaging;
    }

    @GetMapping
    public List<Listing> getListings(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) String condition,
            @RequestParam(required = false) String pickupArea,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate startDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate endDate,
            @RequestParam(required = false) String q) {

        return service.getListings(
                category, minPrice, maxPrice,
                condition, pickupArea, startDate, endDate, q
        );
    }


    @GetMapping("/{id}")
    public ListingDetailsResponse getListingById(@PathVariable String id, Authentication authentication) {

        ObjectId listingId = convertToObjectId(id);

        return service.getListingById(listingId, authentication == null ? null : authentication.getName());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Listing createListing(
            @Valid @RequestBody CreateListingRequest request,
            Authentication authentication) {

        Listing created = service.createSecureListing(
                request,
                authentication.getName()
        );
        broadcastUpdate();
        return created;
    }

    @PutMapping("/{id}")
    public Listing updateListing(
            @PathVariable String id,
            @Valid @RequestBody CreateListingRequest request,
            Authentication authentication) {

        if (authentication == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Login required"
            );
        }

        Listing updated = service.updateListing(
                convertToObjectId(id),
                request,
                authentication.getName()
        );
        broadcastUpdate();
        return updated;
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteListing(
            @PathVariable String id,
            Authentication authentication) {

        service.deleteListing(
                convertToObjectId(id),
                authentication.getName()
        );
        broadcastUpdate();
    }

    @PatchMapping("/{id}/status")
    public Listing updateStatus(
            @PathVariable String id,
            @RequestParam ListingStatus status,
            Authentication authentication) {

        Listing updated = service.updateStatus(
                convertToObjectId(id),
                status,
                authentication.getName()
        );
        broadcastUpdate();
        return updated;
    }

    private void broadcastUpdate() {
        if (messaging == null) return;
        try {
            messaging.convertAndSend("/topic/listings", "updated");
        } catch (Exception ex) {
            log.warn("Could not broadcast listing update", ex);
        }
    }

    private ObjectId convertToObjectId(String id) {
        if (!ObjectId.isValid(id)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid listing ID"
            );
        }
        return new ObjectId(id);
    }
}
