
package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.dto.MyListingsResponse;
import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.service.MyListingsService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/users/me/listings")
public class MyListingsController {

    private final MyListingsService myListingsService;

    public MyListingsController(
            MyListingsService myListingsService
    ) {
        this.myListingsService = myListingsService;
    }

    @GetMapping
    public ResponseEntity<List<Listing>> getMyListings(
            Authentication authentication
    ) {
        String email = authentication.getName();

        return ResponseEntity.ok(
                myListingsService.getMyListings(email)
        );
    }

    @GetMapping("/{id}")
    public ResponseEntity<Listing> getMyListing(
            @PathVariable String id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(
                myListingsService.getMyListing(
                        id,
                        authentication.getName()
                )
        );
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteMyListing(
            @PathVariable String id,
            Authentication authentication
    ) {
        myListingsService.deleteMyListing(
                id,
                authentication.getName()
        );

        return ResponseEntity.ok(
                Map.of(
                        "message",
                        "Listing deleted successfully"
                )
        );
    }

    @GetMapping("/grouped")
    public MyListingsResponse getMyListingsGrouped(
            Authentication authentication
    ) {
        return myListingsService.getMyListingsGrouped(
                authentication.getName()
        );
    }
}
