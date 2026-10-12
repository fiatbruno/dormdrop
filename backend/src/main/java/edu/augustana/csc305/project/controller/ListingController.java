
package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.model.ListingStatus;
import edu.augustana.csc305.project.service.ListingService;
import edu.augustana.csc305.project.dto.CreateListingRequest;

import org.bson.types.ObjectId;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import jakarta.validation.Valid;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/home")
@CrossOrigin(origins = "http://localhost:5173")
public class ListingController {

    private final ListingService service;

    public ListingController(ListingService service) {
        this.service = service;
    }

    // Retrieve and filter listings
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
            LocalDate endDate) {

        return service.getListings(
                category,
                minPrice,
                maxPrice,
                condition,
                pickupArea,
                startDate,
                endDate
        );
    }

    // Create a new listing
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Listing createListing(
            @Valid @RequestBody CreateListingRequest request,
            Authentication authentication) {

        return service.createSecureListing(
                request,
                authentication.getName()
        );
    }

    // Update an existing listing
    @PutMapping("/{id}")
    public Listing updateListing(
            @PathVariable String id,
            @Valid @RequestBody CreateListingRequest request,
            Authentication authentication) {

        ObjectId listingId = convertToObjectId(id);

        return service.updateListing(
                listingId,
                request,
                authentication.getName()
        );
    }

    // Delete a listing
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteListing(
            @PathVariable String id,
            Authentication authentication) {

        ObjectId listingId = convertToObjectId(id);

        service.deleteListing(
                listingId,
                authentication.getName()
        );
    }

    // Change listing status
    @PatchMapping("/{id}/status")
    public Listing updateStatus(
            @PathVariable String id,
            @RequestParam ListingStatus status,
            Authentication authentication) {

        ObjectId listingId = convertToObjectId(id);

        return service.updateStatus(
                listingId,
                status,
                authentication.getName()
        );
    }

    // Validate and convert MongoDB listing ID
    private ObjectId convertToObjectId(String id) {

        if (!ObjectId.isValid(id)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid MongoDB listing ID"
            );
        }

        return new ObjectId(id);
    }
}
