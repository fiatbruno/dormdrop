
package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.dto.CreateListingRequest;
import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.model.ListingStatus;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.ListingRepository;
import edu.augustana.csc305.project.repository.UserRepository;

import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
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

    public List<Listing> getListings(
            String category,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            String condition,
            String pickupArea,
            LocalDate startDate,
            LocalDate endDate) {

        Query query = new Query();

        if (category != null &&
                !category.isBlank() &&
                !category.equalsIgnoreCase("All Items")) {

            query.addCriteria(
                    Criteria.where("category").regex(
                            "^" + Pattern.quote(category) + "$", "i"
                    )
            );
        }

        if (minPrice != null || maxPrice != null) {
            Criteria price = Criteria.where("price");

            if (minPrice != null) {
                price.gte(minPrice);
            }

            if (maxPrice != null) {
                price.lte(maxPrice);
            }

            query.addCriteria(price);
        }

        if (condition != null && !condition.isBlank()) {
            query.addCriteria(
                    Criteria.where("condition").regex(
                            "^" + Pattern.quote(condition) + "$", "i"
                    )
            );
        }

        if (pickupArea != null && !pickupArea.isBlank()) {
            query.addCriteria(
                    Criteria.where("pickupArea").regex(
                            "^" + Pattern.quote(pickupArea) + "$", "i"
                    )
            );
        }

        if (startDate != null || endDate != null) {
            Criteria dates = Criteria.where("listedOn");

            if (startDate != null) {
                dates.gte(startDate.atStartOfDay());
            }

            if (endDate != null) {
                dates.lt(endDate.plusDays(1).atStartOfDay());
            }

            query.addCriteria(dates);
        }

        query.with(
                Sort.by(Sort.Direction.DESC, "listedOn")
        );

        return mongoTemplate.find(query, Listing.class);
    }

    private User currentUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.UNAUTHORIZED,
                                "User not found"
                        )
                );
    }

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

    private void applyChanges(
            Listing listing,
            CreateListingRequest request) {

        listing.setTitle(request.title());
        listing.setDescription(request.description());
        listing.setCategory(request.category());
        listing.setPrice(request.price());
        listing.setCondition(request.condition());
        listing.setPickupArea(request.pickupArea());

        String type = request.listingType();

        listing.setListingType(
                type == null || type.isBlank()
                        ? "For sale"
                        : type
        );
    }

    public Listing createListing(Listing listing) {
        return repository.save(listing);
    }

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

    public Listing updateListing(
            ObjectId id,
            CreateListingRequest request,
            String email) {

        Listing listing = ownedListing(id, email);
        applyChanges(listing, request);

        return repository.save(listing);
    }

    public void deleteListing(ObjectId id, String email) {
        Listing listing = ownedListing(id, email);
        repository.delete(listing);
    }

    public Listing updateStatus(
            ObjectId id,
            ListingStatus status,
            String email) {

        Listing listing = ownedListing(id, email);
        listing.setStatus(status);

        return repository.save(listing);
    }


    public Listing getListingById(ObjectId id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Listing not found"
                ));
    }
}
