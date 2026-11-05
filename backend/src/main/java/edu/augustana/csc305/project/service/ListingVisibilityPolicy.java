package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.model.*;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/** Shared moderation policy. Lifecycle and moderation visibility remain independent. */
@Component
public class ListingVisibilityPolicy {
    /** Integration point for a future account policy; suspensions are deliberately not implemented here. */
    protected boolean accountAllowsMarketplace(User user) { return true; }

    public boolean visible(Listing listing) {
        return listing != null && listing.getModerationVisibility() == ModerationTypes.Visibility.VISIBLE;
    }
    public Criteria visibleCriteria() {
        // Mongo null matches missing fields, so unmigrated legacy listings stay visible.
        return Criteria.where("moderationVisibility").in("VISIBLE", null);
    }
    public boolean maySeeRestrictedSummary(Listing listing, User viewer) {
        return listing != null && viewer != null && accountAllowsMarketplace(viewer)
                && (viewer.getId().equals(listing.getOwnerId()) || viewer.getRole().name().equals("ADMIN")
                    || viewer.getRole().name().equals("MODERATOR"));
    }
    public Listing view(Listing listing, User viewer) {
        if (listing == null || !accountAllowsMarketplace(viewer)) throw notFound();
        if (visible(listing)) return listing;
        if (!maySeeRestrictedSummary(listing, viewer)) throw notFound();
        return restrictedSummary(listing);
    }
    public Listing restrictedSummary(Listing listing) {
        Listing summary = new Listing();
        summary.setId(listing.getId());
        summary.setTitle("Listing restricted");
        summary.setListingType(null);
        summary.setStatus(listing.getStatus());
        summary.setModerationVisibility(listing.getModerationVisibility());
        summary.setVersion(listing.getVersion());
        return summary;
    }
    public void requireVisible(Listing listing) { if (!visible(listing)) throw notFound(); }
    public void requireNewConversation(Listing listing, User viewer) {
        requireVisible(listing);
        if (!accountAllowsMarketplace(viewer)) throw notFound();
        if (listing.getStatus() != ListingStatus.AVAILABLE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Listing is no longer available.");
        }
    }
    public void requireSellerMutation(Listing listing, User viewer) {
        if (viewer == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required.");
        if (!viewer.getId().equals(listing.getOwnerId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not own this listing.");
        }
        if (!accountAllowsMarketplace(viewer) || !visible(listing)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Restricted listings cannot be changed by the seller.");
        }
    }
    public void requireStatusTransition(Listing listing, ListingStatus next) {
        if (next == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status is required.");
        if ((listing.getStatus() == ListingStatus.SOLD && next != ListingStatus.SOLD && next != ListingStatus.AVAILABLE)
                || (listing.getStatus() == ListingStatus.DONATED && next != ListingStatus.DONATED)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Completed listings cannot be reopened or reclassified.");
        }
    }
    private ResponseStatusException notFound() { return new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found."); }
}
