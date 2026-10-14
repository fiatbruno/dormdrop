
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

    @GetMapping
    public List<String> getFavorites(Authentication auth) {
        return service.getFavorites(auth.getName())
                .stream()
                .map(ObjectId::toHexString)
                .toList();
    }

    @PostMapping("/{listingId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void addFavorite(
            @PathVariable String listingId,
            Authentication auth) {

        service.addFavorite(
                convertToObjectId(listingId),
                auth.getName()
        );
    }

    @DeleteMapping("/{listingId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeFavorite(
            @PathVariable String listingId,
            Authentication auth) {

        service.removeFavorite(
                convertToObjectId(listingId),
                auth.getName()
        );
    }

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
