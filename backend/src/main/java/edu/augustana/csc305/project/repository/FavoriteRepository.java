
package edu.augustana.csc305.project.repository;

import edu.augustana.csc305.project.model.Favorite;

import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface FavoriteRepository
        extends MongoRepository<Favorite, ObjectId> {

    // Get all favorites belonging to a user
    List<Favorite> findByUserId(ObjectId userId);

    // Find a specific favorite
    Optional<Favorite> findByUserIdAndListingId(
            ObjectId userId,
            ObjectId listingId
    );

    // Remove a favorite
    void deleteByUserIdAndListingId(
            ObjectId userId,
            ObjectId listingId
    );

    // Check whether a listing is already bookmarked
    boolean existsByUserIdAndListingId(
            ObjectId userId,
            ObjectId listingId
    );
}
