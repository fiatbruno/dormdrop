
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

    private User getUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.UNAUTHORIZED,
                                "User not found"
                        )
                );
    }

    public List<ObjectId> getFavorites(String email) {
        User user = getUser(email);

        return favoriteRepository.findByUserId(user.getId())
                .stream()
                .map(Favorite::getListingId)
                .toList();
    }

    public void addFavorite(ObjectId listingId, String email) {
        User user = getUser(email);

        if (!listingRepository.existsById(listingId)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Listing not found"
            );
        }

        if (favoriteRepository.existsByUserIdAndListingId(
                user.getId(), listingId)) {
            return;
        }

        favoriteRepository.save(
                new Favorite(user.getId(), listingId)
        );
    }

    public void removeFavorite(ObjectId listingId, String email) {
        User user = getUser(email);

        favoriteRepository.deleteByUserIdAndListingId(
                user.getId(), listingId
        );
    }
}
