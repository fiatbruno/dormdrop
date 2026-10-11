package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.repository.ListingRepository;
import edu.augustana.csc305.project.service.ImageStorageService;

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
@RequestMapping("/api/images")
public class ImageController {

    private final ImageStorageService storage;
    private final ListingRepository listings;

    public ImageController(
            ImageStorageService storage,
            ListingRepository listings) {

        this.storage = storage;
        this.listings = listings;
    }

    @PostMapping("/{listingId}")
    public Map<String, String> uploadImage(
            @PathVariable Long listingId,
            @RequestParam("file") MultipartFile file,
            Authentication auth) {

        Listing listing = listings.findById(listingId)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Listing not found"
                        ));

        if (!listing.getOwner().getEmail()
                .equals(auth.getName())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Not your listing"
            );
        }

        String url = storage.store(file);

        listing.setImageUrl(url);
        listings.save(listing);

        return Map.of("imageUrl", url);
    }

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
}