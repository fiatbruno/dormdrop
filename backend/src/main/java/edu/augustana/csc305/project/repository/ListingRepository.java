package edu.augustana.csc305.project.repository;
import edu.augustana.csc305.project.model.Listing;
import org.bson.types.ObjectId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.lang.ScopedValue;


public interface ListingRepository
            extends JpaRepository<Listing, Long>,
            JpaSpecificationExecutor<Listing> {
        <T> ScopedValue<T> findById(ObjectId listingId);
    }

