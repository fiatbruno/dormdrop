
package edu.augustana.csc305.project.repository;

import edu.augustana.csc305.project.model.SavedListing;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface SavedListingRepository
        extends MongoRepository<SavedListing, ObjectId> {

    List<SavedListing> findByUserIdOrderBySavedAtDesc(
            ObjectId userId
    );

    Optional<SavedListing> findByUserIdAndListingId(
            ObjectId userId,
            ObjectId listingId
    );

    boolean existsByUserIdAndListingId(
            ObjectId userId,
            ObjectId listingId
    );

    long countByUserId(ObjectId userId);

    long deleteByUserIdAndListingId(
            ObjectId userId,
            ObjectId listingId
    );
}
