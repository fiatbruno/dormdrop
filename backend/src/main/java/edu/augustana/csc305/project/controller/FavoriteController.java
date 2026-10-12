
package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.service.FavoriteService;

import org.bson.types.ObjectId;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/favorites")
public class FavoriteController {

    private final FavoriteService service;

    public FavoriteController(FavoriteService service) {
        this.service = service;
    }

    // Get all bookmarked listing IDs
    @GetMapping
    public List<String> getFavorites(Authentication auth) {

        return service.getFavorites(auth.getName())
                .stream()
                .map(ObjectId::toHexString)
                .toList();
    }

    // Bookmark a listing
    @PostMapping("/{listingId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void addFavorite(
            @PathVariable String listingId,
            Authentication auth) {

        ObjectId id = convertToObjectId(listingId);

        service.addFavorite(id, auth.getName());
    }

    // Remove a bookmark
    @DeleteMapping("/{listingId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeFavorite(
            @PathVariable String listingId,
            Authentication auth) {

        ObjectId id = convertToObjectId(listingId);

        service.removeFavorite(id, auth.getName());
    }

    // Convert a String to a MongoDB ObjectId
    private ObjectId convertToObjectId(String id) {

        if (!ObjectId.isValid(id)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid listing ID"
            );
        }

        return new ObjectId(id);
    }
}
