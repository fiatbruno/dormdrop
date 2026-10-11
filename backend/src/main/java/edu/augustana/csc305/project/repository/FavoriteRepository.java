package edu.augustana.csc305.project.repository;


import edu.augustana.csc305.project.model.Favorite;
import org.bson.types.ObjectId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FavoriteRepository
        extends JpaRepository<Favorite, Long> {

    List<Favorite> findByUserId(Long userId);

    Optional<Favorite> findByUserIdAndListingId(
            Long userId,
            Long listingId
    );

    void deleteByUserIdAndListingId(
            Long userId,
            ObjectId listingId
    );

    boolean existsByUserIdAndListingId(
            Long userId,
            ObjectId listingId
    );
}