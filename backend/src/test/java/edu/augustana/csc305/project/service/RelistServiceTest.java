package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.model.ListingStatus;
import edu.augustana.csc305.project.model.ModerationTypes.Visibility;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.ListingRepository;
import edu.augustana.csc305.project.repository.UserRepository;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RelistServiceTest {
    private final ListingRepository listings = mock(ListingRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final ImageStorageService images = mock(ImageStorageService.class);
    private final RelistService service = new RelistService(listings, users, new ListingVisibilityPolicy(), images);
    private final User owner = new User(new ObjectId(), "Seller", "seller@example.edu", "hash");

    private Listing sold() {
        var listing = new Listing();
        listing.setId(new ObjectId());
        listing.setOwnerId(owner.getId());
        listing.setTitle("Desk");
        listing.setStatus(ListingStatus.SOLD);
        listing.setImageUrl("/api/v1/images/original.jpg");
        when(users.findByEmail(owner.getEmail())).thenReturn(Optional.of(owner));
        when(listings.findById(listing.getId())).thenReturn(Optional.of(listing));
        return listing;
    }

    @Test
    void createsNewAvailableListingAndKeepsSoldRecord() {
        var original = sold();
        when(images.copyListingImage(original.getImageUrl())).thenReturn("/api/v1/images/copy.jpg");
        when(listings.save(any(Listing.class))).thenAnswer(invocation -> invocation.getArgument(0));
        var copy = service.relist(original.getId(), owner.getEmail());
        assertNotSame(original, copy);
        assertNull(copy.getId());
        assertEquals(ListingStatus.SOLD, original.getStatus());
        assertEquals(ListingStatus.AVAILABLE, copy.getStatus());
        assertEquals(original.getTitle(), copy.getTitle());
        assertEquals(owner.getId(), copy.getOwnerId());
        assertEquals("/api/v1/images/copy.jpg", copy.getImageUrl());
        verify(listings).save(original);
        verify(listings).save(copy);
    }

    @Test
    void restrictedOrOtherUsersListingsCannotBeRelisted() {
        var original = sold();
        original.setModerationVisibility(Visibility.REMOVED);
        assertThrows(ResponseStatusException.class, () -> service.relist(original.getId(), owner.getEmail()));
        original.setModerationVisibility(Visibility.VISIBLE);
        original.setOwnerId(new ObjectId());
        assertThrows(ResponseStatusException.class, () -> service.relist(original.getId(), owner.getEmail()));
        verifyNoInteractions(images);
        verify(listings, never()).save(any());
    }

    @Test
    void removesCopiedImageIfSavingFails() {
        var original = sold();
        when(images.copyListingImage(original.getImageUrl())).thenReturn("/api/v1/images/copy.jpg");
        when(listings.save(original)).thenThrow(new IllegalStateException("changed"));
        assertThrows(IllegalStateException.class, () -> service.relist(original.getId(), owner.getEmail()));
        verify(images).discardNewUpload("/api/v1/images/copy.jpg");
    }
}
