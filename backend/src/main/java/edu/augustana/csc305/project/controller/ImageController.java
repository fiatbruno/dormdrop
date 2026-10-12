
package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.repository.ListingRepository;
import edu.augustana.csc305.project.service.ImageStorageService;

import org.bson.types.ObjectId;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Map;

@RestController
@RequestMapping("/images")
public class ImageController {

    private final ImageStorageService storage;
    private final ListingRepository listings;

    public ImageController(
            ImageStorageService storage,
            ListingRepository listings) {

        this.storage = storage;
        this.listings = listings;
    }

    // Upload an image for a listing
    @PostMapping("/{listingId}")
    public Map<String, String> uploadImage(
            @PathVariable String listingId,
            @RequestParam("file") MultipartFile file,
            Authentication auth) {

        // Validate and convert MongoDB ObjectId
        ObjectId id = convertToObjectId(listingId);

        // Find listing in MongoDB
        Listing listing = listings.findById(id)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Listing not found"
                        )
                );

        // Check that the logged-in user owns the listing
        if (auth == null ||
                listing.getTitle() == null ||
                !listing.getTitle()
                        .equals(auth.getName())) {

            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You do not own this listing"
            );
        }

        // Save the image to storage
        String url = storage.store(file);

        // Save the image URL in MongoDB
        listing.setImageUrl(url);
        listings.save(listing);

        return Map.of("imageUrl", url);
    }

    // Retrieve an uploaded image
    @GetMapping("/{filename}")
    public ResponseEntity<Resource> getImage(
            @PathVariable String filename) throws IOException {

        Path path = storage.getImage(filename);

        Resource resource = new UrlResource(path.toUri());

        String type = filename.endsWith(".png")
                ? "image/png"
                : filename.endsWith(".webp")
                ? "image/webp"
                : "image/jpeg";

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(type))
                .body(resource);
    }

    // Convert String to MongoDB ObjectId
    private ObjectId convertToObjectId(String id) {

        if (!ObjectId.isValid(id)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid MongoDB listing ID"
            );
        }

        return new ObjectId(id);
    }
}
