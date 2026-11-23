package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.model.ListingStatus;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.model.UserRole;
import edu.augustana.csc305.project.model.ModerationTypes.Visibility;
import org.bson.types.ObjectId;
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
    void sellerHiddenListingIsOnlyReadableByOwnerAndStaff() {
        User owner = user(UserRole.STUDENT);
        User buyer = user(UserRole.STUDENT);
        User admin = user(UserRole.ADMIN);
        Listing listing = new Listing();
        listing.setOwnerId(owner.getId());
        listing.setSellerHidden(true);

        assertFalse(policy.visible(listing));
        assertEquals(true, policy.visibleCriteria().getCriteriaObject()
                .get("sellerHidden", org.bson.Document.class).get("$ne"));
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ResponseStatusException.class,
                () -> policy.view(listing, buyer)).getStatusCode());
        assertFalse(policy.maySeePhoto(listing, buyer));
        assertSame(listing, policy.view(listing, owner));
        assertSame(listing, policy.view(listing, admin));
        assertTrue(policy.maySeePhoto(listing, owner));
        assertTrue(policy.maySeePhoto(listing, admin));
        assertDoesNotThrow(() -> policy.requireSellerMutation(listing, owner));
        assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
                () -> policy.requireSellerMutation(listing, admin)).getStatusCode());

        listing.setSellerHidden(false);
        assertTrue(policy.visible(listing));
        listing.setModerationVisibility(Visibility.HIDDEN);
        assertFalse(policy.visible(listing));
        assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class,
                () -> policy.requireSellerMutation(listing, owner)).getStatusCode());
    }

    private User user(UserRole role) {
        User user = new User();
        user.setId(new ObjectId());
        user.setRole(role);
        return user;
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
