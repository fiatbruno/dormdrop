
package edu.augustana.csc305.project.repository;

import edu.augustana.csc305.project.model.Listing;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ListingRepository
        extends MongoRepository<Listing, ObjectId> {
}
