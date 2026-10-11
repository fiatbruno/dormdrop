
package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.model.Favorite;
import edu.augustana.csc305.project.model.User;

import edu.augustana.csc305.project.repository.FavoriteRepository;
import edu.augustana.csc305.project.repository.ListingRepository;
import edu.augustana.csc305.project.repository.UserRepository;

import org.bson.types.ObjectId;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
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

    // Get the currently logged-in user
    private User getUser(String email) {

        return userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.UNAUTHORIZED,
                                "User not found"
                        )
                );
    }

    // Get all favorite listing IDs for a user
    public List<ObjectId> getFavorites(String email) {

        User user = getUser(email);

        return favoriteRepository.findByUserId(user.getId())
                .stream()
                .map(Favorite::getListingId)
                .toList();
    }

    // Add a listing to favorites
    public void addFavorite(ObjectId listingId, String email) {

        User user = getUser(email);

        // Check whether the listing exists in MongoDB
        if (!listingRepository.existsById(listingId)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Listing not found"
            );
        }

        // Prevent duplicate bookmarks
        if (favoriteRepository.existsByUserIdAndListingId(
                user.getId(), listingId)) {
            return;
        }

        // Store userId and listingId directly
        Favorite favorite = new Favorite(
                user.getId(),
                listingId
        );

        favoriteRepository.save(favorite);
    }

    // Remove a listing from favorites
    public void removeFavorite(ObjectId listingId, String email) {

        User user = getUser(email);

        favoriteRepository.deleteByUserIdAndListingId(
                user.getId(),
                listingId
        );
    }
}
