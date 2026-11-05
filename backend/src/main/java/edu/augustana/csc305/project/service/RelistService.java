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
    private final ImageStorageService images;

    public RelistService(ListingRepository listings, UserRepository users,
                         ListingVisibilityPolicy visibility, ImageStorageService images) {
        this.listings = listings;
        this.users = users;
        this.visibility = visibility;
        this.images = images;
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

        Listing copy = new Listing();
        copy.setTitle(original.getTitle());
        copy.setDescription(original.getDescription());
        copy.setCategory(original.getCategory());
        copy.setPrice(original.getPrice());
        copy.setCondition(original.getCondition());
        copy.setPickupArea(original.getPickupArea());
        copy.setListingType(original.getListingType());
        copy.setOwnerId(user.getId());
        copy.setStatus(ListingStatus.AVAILABLE);
        String image = original.getImageUrl() == null || original.getImageUrl().isBlank()
                ? null : images.copyListingImage(original.getImageUrl());
        copy.setImageUrl(image);
        try {
            // Check the source version before creating a new listing, including moderation changes.
            listings.save(original);
            return listings.save(copy);
        } catch (RuntimeException ex) {
            if (image != null) images.discardNewUpload(image);
            throw ex;
        }
    }
}
