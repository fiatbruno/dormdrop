
package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.dto.SavedListingResponse;
import edu.augustana.csc305.project.service.SavedListingService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/saved")
public class SavedListingController {

    private final SavedListingService savedListingService;

    public SavedListingController(
            SavedListingService savedListingService
    ) {
        this.savedListingService = savedListingService;
    }

    @GetMapping
    public List<SavedListingResponse> getSavedListings(
            @RequestParam(defaultValue = "all") String filter,
            Authentication authentication
    ) {
        return savedListingService.getSavedListings(
                authentication.getName(),
                filter
        );
    }

    @PostMapping("/{listingId}")
    public ResponseEntity<SavedListingResponse> saveListing(
            @PathVariable String listingId,
            Authentication authentication
    ) {
        SavedListingResponse saved =
                savedListingService.saveListing(
                        authentication.getName(),
                        listingId
                );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(saved);
    }

    @DeleteMapping("/{listingId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeSavedListing(
            @PathVariable String listingId,
            Authentication authentication
    ) {
        savedListingService.removeSavedListing(
                authentication.getName(),
                listingId
        );
    }

    @GetMapping("/count")
    public Map<String, Long> getSavedCount(
            Authentication authentication
    ) {
        long count = savedListingService.getSavedCount(
                authentication.getName()
        );

        return Map.of("count", count);
    }

    @GetMapping("/{listingId}/status")
    public SavedListingResponse getSavedListingStatus(
            @PathVariable String listingId,
            Authentication authentication
    ) {
        return savedListingService.getSavedListingStatus(
                authentication.getName(),
                listingId
        );
    }

    @GetMapping("/{listingId}/check")
    public Map<String, Boolean> checkIfSaved(
            @PathVariable String listingId,
            Authentication authentication
    ) {
        boolean saved = savedListingService.isListingSaved(
                authentication.getName(),
                listingId
        );

        return Map.of("saved", saved);
    }
}
