package edu.augustana.csc305.project;

import edu.augustana.csc305.project.controller.ImageController;
import edu.augustana.csc305.project.controller.ListingController;
import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.model.ListingStatus;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.ListingRepository;
import edu.augustana.csc305.project.repository.UserRepository;
import edu.augustana.csc305.project.service.ImageStorageService;
import edu.augustana.csc305.project.service.ListingService;
import edu.augustana.csc305.project.service.ListingVisibilityPolicy;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import java.util.List;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ListingLiveUpdateTest {
    @Test
    void imageUploadNotifiesAfterSaveAndNeverOnFailure() {
        var storage = mock(ImageStorageService.class);
        var listings = mock(ListingRepository.class);
        var users = mock(UserRepository.class);
        var messaging = mock(SimpMessagingTemplate.class);
        var user = new User(new ObjectId(), "Seller", "seller@example.edu", "hash");
        var listing = new Listing();
        listing.setId(new ObjectId());
        listing.setOwnerId(user.getId());
        var auth = new UsernamePasswordAuthenticationToken(user.getEmail(), null, List.of());
        var file = new MockMultipartFile("file", "photo.jpg", "image/jpeg", new byte[]{1});
        when(users.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(listings.findById(listing.getId())).thenReturn(Optional.of(listing));
        when(storage.store(file)).thenReturn("/api/v1/images/photo.jpg");
        when(listings.save(listing)).thenReturn(listing).thenThrow(new IllegalStateException("save failed"));
        var controller = new ImageController(storage, listings, users, new ListingVisibilityPolicy(), messaging);

        controller.uploadImage(listing.getIdString(), file, auth);
        var order = inOrder(listings, messaging);
        order.verify(listings).save(listing);
        order.verify(messaging).convertAndSend("/topic/listings", "updated");
        assertThrows(IllegalStateException.class, () -> controller.uploadImage(listing.getIdString(), file, auth));
        verify(messaging, times(1)).convertAndSend("/topic/listings", "updated");
        verify(storage).discardNewUpload("/api/v1/images/photo.jpg");
    }

    @Test
    void statusChangeNotifiesOnlyAfterSuccessfulSave() {
        var service = mock(ListingService.class);
        var messaging = mock(SimpMessagingTemplate.class);
        var id = new ObjectId();
        var auth = new UsernamePasswordAuthenticationToken("seller@example.edu", null, List.of());
        when(service.updateStatus(id, ListingStatus.SOLD, auth.getName()))
                .thenReturn(new Listing()).thenThrow(new IllegalStateException("save failed"));
        var controller = new ListingController(service, messaging);
        controller.updateStatus(id.toHexString(), ListingStatus.SOLD, auth);
        assertThrows(IllegalStateException.class, () -> controller.updateStatus(id.toHexString(), ListingStatus.SOLD, auth));
        verify(messaging, times(1)).convertAndSend("/topic/listings", "updated");
    }
}
