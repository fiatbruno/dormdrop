package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.service.FavoriteService;

import org.bson.types.ObjectId;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/favorites")
public class FavoriteController {

    private final FavoriteService service;

    public FavoriteController(FavoriteService service) {
        this.service = service;
    }

    @GetMapping
    public List<Long> getFavorites(Authentication auth) {
        return service.getFavorites(auth.getName());
    }

    @PostMapping("/{listingId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void addFavorite(
            @PathVariable ObjectId listingId,
            Authentication auth) {

        service.addFavorite(listingId, auth.getName());
    }

    @DeleteMapping("/{listingId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeFavorite(
            @PathVariable ObjectId listingId,
            Authentication auth) {

        service.removeFavorite(listingId, auth.getName());
    }
}