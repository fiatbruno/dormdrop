
package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.dto.CreateListingRequest;
import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.model.ListingStatus;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.ListingRepository;
import edu.augustana.csc305.project.repository.UserRepository;

import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.regex.Pattern;

@Service
public class ListingService {

    private final ListingRepository repository;
    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;

    public ListingService(
            ListingRepository repository,
            UserRepository userRepository,
            MongoTemplate mongoTemplate) {

        this.repository = repository;
        this.userRepository = userRepository;
        this.mongoTemplate = mongoTemplate;
    }

    // Retrieve listings with optional filters
    public List<Listing> getListings(
            String category,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            String condition,
            String pickupArea,
            LocalDate startDate,
            LocalDate endDate) {

        Query query = new Query();

        // Filter by category (case-insensitive)
        if (category != null && !category.isBlank()
                && !category.equalsIgnoreCase("All Items")) {

            query.addCriteria(
                    Criteria.where("category")
                            .regex("^" + Pattern.quote(category) + "$", "i")
            );
        }

        // Minimum price
        if (minPrice != null) {
            query.addCriteria(
                    Criteria.where("price").gte(minPrice)
            );
        }

        // Maximum price
        if (maxPrice != null) {
            query.addCriteria(
                    Criteria.where("price").lte(maxPrice)
            );
        }

        // Filter by condition (case-insensitive)
        if (condition != null && !condition.isBlank()) {
            query.addCriteria(
                    Criteria.where("condition")
                            .regex("^" + Pattern.quote(condition) + "$", "i")
            );
        }

        // Filter by pickup area (case-insensitive)
        if (pickupArea != null && !pickupArea.isBlank()) {
            query.addCriteria(
                    Criteria.where("pickupArea")
                            .regex("^" + Pattern.quote(pickupArea) + "$", "i")
            );
        }

        // Start date (inclusive)
        if (startDate != null) {
            query.addCriteria(
                    Criteria.where("listedOn")
                            .gte(startDate.atStartOfDay())
            );
        }

        // End date (inclusive)
        if (endDate != null) {
            query.addCriteria(
                    Criteria.where("listedOn")
                            .lt(endDate.plusDays(1).atStartOfDay())
            );
        }

        return mongoTemplate.find(query, Listing.class);
    }

    // Save a listing
    public Listing createListing(Listing listing) {
        return repository.save(listing);
    }

    // Get the logged-in user
    private User currentUser(String email) {

        return userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.UNAUTHORIZED,
                                "User not found"
                        )
                );
    }

    // Find a listing and verify ownership
    private Listing ownedListing(ObjectId id, String email) {

        Listing listing = repository.findById(id)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Listing not found"
                        )
                );

        User user = currentUser(email);

        if (listing.getOwnerId() == null ||
                !listing.getOwnerId().equals(user.getId())) {

            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You do not own this listing"
            );
        }

        return listing;
    }

    // Apply changes from the request
    private void applyChanges(
            Listing listing,
            CreateListingRequest request) {

        listing.setTitle(request.title());
        listing.setDescription(request.description());
        listing.setCategory(request.category());
        listing.setPrice(request.price());
        listing.setCondition(request.condition());
        listing.setPickupArea(request.pickupArea());
    }

    // Create a listing for the logged-in student
    public Listing createSecureListing(
            CreateListingRequest request,
            String email) {

        User user = currentUser(email);

        Listing listing = new Listing();

        applyChanges(listing, request);

        listing.setOwnerId(user.getId());
        listing.setStatus(ListingStatus.AVAILABLE);

        return repository.save(listing);
    }

    // Update an existing listing
    public Listing updateListing(
            ObjectId id,
            CreateListingRequest request,
            String email) {

        Listing listing = ownedListing(id, email);

        applyChanges(listing, request);

        return repository.save(listing);
    }

    // Delete a listing
    public void deleteListing(ObjectId id, String email) {

        Listing listing = ownedListing(id, email);

        repository.delete(listing);
    }

    // Update listing status
    public Listing updateStatus(
            ObjectId id,
            ListingStatus status,
            String email) {

        Listing listing = ownedListing(id, email);

        listing.setStatus(status);

        return repository.save(listing);
    }
}
