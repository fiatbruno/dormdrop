package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.service.ListingService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import edu.augustana.csc305.project.dto.CreateListingRequest;
import edu.augustana.csc305.project.model.ListingStatus;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;

@RestController
@RequestMapping("/listings")
@CrossOrigin(origins = "http://localhost:5173")

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
            @PathVariable Long id,
            @Valid @RequestBody CreateListingRequest request,
            Authentication authentication) {

        return service.updateListing(
                id, request, authentication.getName()
        );
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteListing(
            @PathVariable Long id,
            Authentication authentication) {

        service.deleteListing(
                id, authentication.getName()
        );
    }

    @PatchMapping("/{id}/status")
    public Listing updateStatus(
            @PathVariable Long id,
            @RequestParam ListingStatus status,
            Authentication authentication) {

        return service.updateStatus(
                id, status, authentication.getName()
        );
    }
}

