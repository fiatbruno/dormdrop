
package edu.augustana.csc305.project.repository;

import edu.augustana.csc305.project.model.Favorite;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface FavoriteRepository
        extends MongoRepository<Favorite, ObjectId> {

    List<Favorite> findByUserId(ObjectId userId);

    Optional<Favorite> findByUserIdAndListingId(
            ObjectId userId,
            ObjectId listingId
    );

    void deleteByUserIdAndListingId(
            ObjectId userId,
            ObjectId listingId
    );

    boolean existsByUserIdAndListingId(
            ObjectId userId,
            ObjectId listingId
    );
}
