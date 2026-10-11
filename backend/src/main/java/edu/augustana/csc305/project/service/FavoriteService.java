package edu.augustana.csc305.project.service;


import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.*;

import org.bson.types.ObjectId;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class FavoriteService {

    private final FavoriteRepository favoriteRepository;
    private final UserRepository userRepository;
    private final ListingRepository listingRepository;

    public FavoriteService(
            FavoriteRepository favoriteRepository,
            UserRepository userRepository,
            ListingRepository listingRepository) {

        this.favoriteRepository = favoriteRepository;
        this.userRepository = userRepository;
        this.listingRepository = listingRepository;
    }

    private User getUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.UNAUTHORIZED,
                                "User not found"
                        ));
    }

    public List<Long> getFavorites(String email) {
        User user = getUser(email);

        return favoriteRepository.findByUserId(user.getId())
                .stream()
                .map(f -> f.getListing().getId())
                .toList();
    }

    public void addFavorite(ObjectId listingId, String email) {
        User user = getUser(email);

        Listing listing = (Listing) listingRepository.findById(listingId)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Listing not found"
                        ));

        if (favoriteRepository.existsByUserIdAndListingId(
                user.getId(), listingId)) {
            return;
        }

        Favorite favorite = new Favorite();
        favorite.setUser(user);
        favorite.setListing(listing);

        favoriteRepository.save(favorite);
    }

    public void removeFavorite(ObjectId listingId, String email) {
        User user = getUser(email);

        favoriteRepository.deleteByUserIdAndListingId(
                user.getId(), listingId
        );
    }
}