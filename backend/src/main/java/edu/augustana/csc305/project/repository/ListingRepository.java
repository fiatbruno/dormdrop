
package edu.augustana.csc305.project.repository;

import edu.augustana.csc305.project.model.Listing;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ListingRepository
        extends MongoRepository<Listing, ObjectId> {
    java.util.List<Listing> findAllByImageUrl(String imageUrl);

    @org.springframework.data.mongodb.repository.Query("{ '$or': [ { 'imageUrl': ?0 }, { 'imageUrls': ?0 } ] }")
    java.util.List<Listing> findAllByPhotoUrl(String imageUrl);
}
