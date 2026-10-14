
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
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/home")
public class ListingController {

    private final ListingService service;

    public ListingController(ListingService service) {
        this.service = service;
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
            LocalDate endDate) {

        return service.getListings(
                category, minPrice, maxPrice,
                condition, pickupArea, startDate, endDate
        );
    }


    @GetMapping("/{id}")
    public ListingDetailsResponse getListingById(@PathVariable String id) {

        ObjectId listingId = convertToObjectId(id);

        return service.getListingById(listingId);
    }

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

        return service.updateListing(
                convertToObjectId(id),
                request,
                authentication.getName()
        );
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
    }

    @PatchMapping("/{id}/status")
    public Listing updateStatus(
            @PathVariable String id,
            @RequestParam ListingStatus status,
            Authentication authentication) {

        return service.updateStatus(
                convertToObjectId(id),
                status,
                authentication.getName()
        );
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
