package edu.augustana.csc305.project.dto;

import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.model.ListingStatus;
import org.bson.types.ObjectId;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ListingDetailsResponse(
        String id,
        String title,
        String description,
        String category,
        BigDecimal price,
        String condition,
        String pickupArea,
        String listingType,
        String imageUrl,
        LocalDateTime listedOn,
        ListingStatus status,
        ObjectId ownerId,
        String sellerName
) {
    public static ListingDetailsResponse from(Listing listing, String sellerName) {
        return new ListingDetailsResponse(
                listing.getIdString(), listing.getTitle(), listing.getDescription(),
                listing.getCategory(), listing.getPrice(), listing.getCondition(),
                listing.getPickupArea(), listing.getListingType(), listing.getImageUrl(),
                listing.getListedOn(), listing.getStatus(), listing.getOwnerId(), sellerName
        );
    }
}
