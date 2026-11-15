package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.model.ListingStatus;
import edu.augustana.csc305.project.model.ModerationTypes.Visibility;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;

class ListingVisibilityPolicyTest {
    private final ListingVisibilityPolicy policy = new ListingVisibilityPolicy();

    @Test
    void visibleListingCanBeSeen() {
        Listing listing = new Listing();
        listing.setModerationVisibility(Visibility.VISIBLE);

        assertTrue(policy.visible(listing));
    }

    @Test
    void hiddenOrMissingListingCannotBeSeen() {
        Listing listing = new Listing();
        listing.setModerationVisibility(Visibility.HIDDEN);

        assertFalse(policy.visible(listing));
        assertFalse(policy.visible(null));
    }

    @Test
    void soldListingCanBeMadeAvailableAgain() {
        Listing listing = new Listing();
        listing.setStatus(ListingStatus.SOLD);

        assertDoesNotThrow(() -> policy.requireStatusTransition(listing, ListingStatus.AVAILABLE));
    }

    @Test
    void donatedListingCannotBeMadeAvailableAgain() {
        Listing listing = new Listing();
        listing.setStatus(ListingStatus.DONATED);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> policy.requireStatusTransition(listing, ListingStatus.AVAILABLE));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }
}
