package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.model.ListingStatus;
import edu.augustana.csc305.project.repository.ListingRepository;
import edu.augustana.csc305.project.repository.UserRepository;
import org.bson.types.ObjectId;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RelistService {
    private final ListingRepository listings;
    private final UserRepository users;
    private final ListingVisibilityPolicy visibility;
    private final ListingService listingService;

    public RelistService(ListingRepository listings, UserRepository users,
                         ListingVisibilityPolicy visibility, ListingService listingService) {
        this.listings = listings;
        this.users = users;
        this.visibility = visibility;
        this.listingService = listingService;
    }

    public Listing relist(ObjectId id, String email) {
        var user = users.findByEmail(email).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found."));
        Listing original = listings.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found."));
        visibility.requireSellerMutation(original, user);
        if (original.getStatus() != ListingStatus.SOLD) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only sold listings can be relisted.");
        }

        return listingService.updateStatus(id, ListingStatus.AVAILABLE, email);
    }
}
