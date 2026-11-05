
package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.ListingRepository;
import edu.augustana.csc305.project.repository.UserRepository;
import edu.augustana.csc305.project.service.ImageStorageService;

import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Map;

@RestController
@RequestMapping("/images")
public class ImageController {

    private static final Logger log = LoggerFactory.getLogger(ImageController.class);
    private final ImageStorageService storage;
    private final ListingRepository listings;
    private final UserRepository users;
    private final edu.augustana.csc305.project.service.ListingVisibilityPolicy visibility;
    private final SimpMessagingTemplate messaging;

    public ImageController(
            ImageStorageService storage,
            ListingRepository listings,
            UserRepository users, edu.augustana.csc305.project.service.ListingVisibilityPolicy visibility) {
        this(storage, listings, users, visibility, null);
    }

    @Autowired
    public ImageController(ImageStorageService storage, ListingRepository listings, UserRepository users,
                           edu.augustana.csc305.project.service.ListingVisibilityPolicy visibility,
                           SimpMessagingTemplate messaging) {
        this.storage = storage;
        this.listings = listings;
        this.users = users;
        this.visibility = visibility;
        this.messaging = messaging;
    }

    @PostMapping("/{listingId}")
    public Map<String, String> uploadImage(
            @PathVariable String listingId,
            @RequestParam("file") MultipartFile file,
            Authentication auth) {

        if (auth == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Login required"
            );
        }

        if (!ObjectId.isValid(listingId)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid listing ID"
            );
        }

        Listing listing = listings.findById(new ObjectId(listingId))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Listing not found"
                ));

        User user = users.findByEmail(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "User not found"
                ));

        if (listing.getOwnerId() == null ||
                !listing.getOwnerId().equals(user.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You do not own this listing"
            );
        }

        visibility.requireSellerMutation(listing, user);
        String url = storage.store(file);
        listing.setImageUrl(url);
        try {
            listings.save(listing);
        } catch (RuntimeException failure) {
            storage.discardNewUpload(url);
            throw failure;
        }

        if (messaging != null) {
            try {
                messaging.convertAndSend("/topic/listings", "updated");
            } catch (Exception ex) {
                log.warn("Could not broadcast listing photo update", ex);
            }
        }

        return Map.of("imageUrl", url);
    }

    @GetMapping("/{filename}")
    public ResponseEntity<Resource> getImage(
            @PathVariable String filename) throws IOException {

        var linked = listings.findAllByImageUrl(storage.imageUrl(filename));
        if (linked.isEmpty() || linked.stream().anyMatch(listing -> !visibility.visible(listing))) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Image not found.");
        }
        Path path = storage.getImage(filename);
        Resource resource = new UrlResource(path.toUri());

        if (!resource.exists() || !resource.isReadable()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Image not found"
            );
        }

        String type = filename.endsWith(".png")
                ? "image/png"
                : filename.endsWith(".webp")
                ? "image/webp"
                : "image/jpeg";

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.parseMediaType(type))
                .body(resource);
    }
}
