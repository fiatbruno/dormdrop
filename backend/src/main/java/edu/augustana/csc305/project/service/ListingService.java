package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.repository.ListingRepository;
import edu.augustana.csc305.project.dto.CreateListingRequest;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.model.ListingStatus;
import edu.augustana.csc305.project.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service

public class ListingService {

    private final ListingRepository repository;
    private UserRepository userRepository;

    public ListingService(ListingRepository repository, UserRepository userRepository) {
        this.repository = repository;
        this.userRepository = userRepository;
    }

    public List<Listing> getListings(
            String category,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            String condition,
            String pickupArea,
            LocalDate startDate,
            LocalDate endDate) {

        Specification<Listing> spec =
                (root, query, cb) -> cb.conjunction();

        if (category != null && !category.isBlank()
                && !category.equalsIgnoreCase("All Items")) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(
                            cb.lower(root.get("category")),
                            category.toLowerCase()
                    ));
        }

        if (minPrice != null) {
            spec = spec.and((root, query, cb) ->
                    cb.greaterThanOrEqualTo(
                            root.get("price"), minPrice
                    ));
        }

        if (maxPrice != null) {
            spec = spec.and((root, query, cb) ->
                    cb.lessThanOrEqualTo(
                            root.get("price"), maxPrice
                    ));
        }

        if (condition != null && !condition.isBlank()) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(
                            cb.lower(root.get("condition")),
                            condition.toLowerCase()
                    ));
        }

        if (pickupArea != null && !pickupArea.isBlank()) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(
                            cb.lower(root.get("pickupArea")),
                            pickupArea.toLowerCase()
                    ));
        }

        if (startDate != null) {
            spec = spec.and((root, query, cb) ->
                    cb.greaterThanOrEqualTo(
                            root.get("listedOn"),
                            startDate.atStartOfDay()
                    ));
        }

        if (endDate != null) {
            spec = spec.and((root, query, cb) ->
                    cb.lessThan(
                            root.get("listedOn"),
                            endDate.plusDays(1).atStartOfDay()
                    ));
        }

        return repository.findAll(spec);
    }

    public Listing createListing(Listing listing) {
        return repository.save(listing);
    }

    private User currentUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.UNAUTHORIZED,
                                "User not found"
                        ));
    }

    private Listing ownedListing(Long id, String email) {
        Listing listing = repository.findById(id)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Listing not found"
                        ));

        if (!listing.getOwner().getEmail().equals(email)) {
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
    }

    public Listing createSecureListing(
            CreateListingRequest request,
            String email) {

        Listing listing = new Listing();

        applyChanges(listing, request);
        listing.setOwner(currentUser(email));
        listing.setStatus(ListingStatus.AVAILABLE);

        return repository.save(listing);
    }

    public Listing updateListing(
            Long id,
            CreateListingRequest request,
            String email) {

        Listing listing = ownedListing(id, email);

        applyChanges(listing, request);

        return repository.save(listing);
    }

    public void deleteListing(Long id, String email) {
        Listing listing = ownedListing(id, email);
        repository.delete(listing);
    }

    public Listing updateStatus(
            Long id,
            ListingStatus status,
            String email) {

        Listing listing = ownedListing(id, email);
        listing.setStatus(status);

        return repository.save(listing);
    }
}