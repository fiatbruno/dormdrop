
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
import java.util.List;
import java.util.ArrayList;
import java.net.URI;
import tools.jackson.databind.json.JsonMapper;

@RestController
@RequestMapping("/images")
public class ImageController {

    private static final int MAX_PHOTOS = 5;

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

        Listing listing = ownedListing(listingId, auth);
        String url = storage.store(file);
        listing.setImageUrl(url);
        try {
            listings.save(listing);
        } catch (RuntimeException failure) {
            storage.discardNewUpload(url);
            throw failure;
        }
        broadcastUpdate();
        return Map.of("imageUrl", url);
    }

    private Listing ownedListing(String listingId, Authentication auth) {

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
        return listing;
    }

    private void broadcastUpdate() {
        if (messaging != null) {
            try {
                messaging.convertAndSend("/topic/listings", "updated");
            } catch (Exception ex) {
                log.warn("Could not broadcast listing photo update", ex);
            }
        }

    }

    // Both create and edit save listing details first, then call this endpoint.
    @PutMapping(value = "/{listingId}/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> savePhotos(
            @PathVariable("listingId") String listingId,
            @RequestParam(name = "retainedImageUrls", defaultValue = "[]") String retainedImageUrls,
            @RequestParam(name = "files", required = false) List<MultipartFile> files,
            Authentication auth) {
        Listing listing = ownedListing(listingId, auth);
        List<String> retained = parseRetainedUrls(retainedImageUrls);
        List<MultipartFile> uploads = files == null ? List.of() : files;
        int total = retained.size() + uploads.size();
        if (total < 1 || total > MAX_PHOTOS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose between 1 and 5 photos.");
        }
        if (retained.stream().distinct().count() != retained.size()
                || !listing.getImageUrls().containsAll(retained)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only photos already on this listing can be retained.");
        }

        List<String> added = new ArrayList<>();
        try {
            for (MultipartFile file : uploads) added.add(storage.storeListingPhoto(file));
            List<String> next = new ArrayList<>(retained);
            next.addAll(added);
            listing.setImageUrls(next);
            // @Version rejects concurrent edits. Save the whole collection together.
            listings.save(listing);
        } catch (RuntimeException failure) {
            added.forEach(storage::discardNewUpload);
            log.error("Could not save photos for listing {}", listingId, failure);
            throw failure;
        }
        broadcastUpdate();
        // Unlinked files cannot be served; leave bytes for concurrent evidence retention.
        return Map.of("imageUrls", listing.getImageUrls(), "imageUrl", listing.getImageUrl());
    }

    private List<String> parseRetainedUrls(String json) {
        try {
            String[] urls = JsonMapper.builder().build().readValue(json, String[].class);
            if (urls == null || urls.length > MAX_PHOTOS) throw new IllegalArgumentException();
            List<String> paths = new ArrayList<>();
            for (String url : urls) {
                // Frontend previews use absolute URLs. Compare their local stored paths.
                URI uri = URI.create(url);
                if (uri.getQuery() != null || uri.getFragment() != null) throw new IllegalArgumentException();
                paths.add(uri.getPath());
            }
            return paths;
        } catch (Exception invalid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid retained photo list.");
        }
    }

    // Return validation reasons to the frontend instead of hiding them behind
    // Spring's default error response.
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> photoError(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).body(Map.of(
                "message", error.getReason() == null ? "Photo request failed." : error.getReason()));
    }

    @GetMapping("/{filename}")
    public ResponseEntity<Resource> getImage(
            @PathVariable String filename, Authentication auth) throws IOException {

        var linked = listings.findAllByPhotoUrl(storage.imageUrl(filename));
        User viewer = auth == null || linked.stream().allMatch(visibility::visible)
                ? null : users.findByEmail(auth.getName()).orElse(null);
        if (linked.isEmpty() || linked.stream().anyMatch(listing -> !visibility.maySeePhoto(listing, viewer))) {
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
