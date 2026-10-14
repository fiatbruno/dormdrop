
package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.dto.SavedListingResponse;
import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.model.ListingStatus;
import edu.augustana.csc305.project.model.SavedListing;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.ListingRepository;
import edu.augustana.csc305.project.repository.SavedListingRepository;
import edu.augustana.csc305.project.repository.UserRepository;

import org.bson.types.ObjectId;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class SavedListingService {

    private final SavedListingRepository savedRepository;
    private final ListingRepository listingRepository;
    private final UserRepository userRepository;

    public SavedListingService(
            SavedListingRepository savedRepository,
            ListingRepository listingRepository,
            UserRepository userRepository
    ) {
        this.savedRepository = savedRepository;
        this.listingRepository = listingRepository;
        this.userRepository = userRepository;
    }

    private User getUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.UNAUTHORIZED,
                                "User account not found."
                        )
                );
    }

    private ObjectId parseId(String id) {
        if (id == null || !ObjectId.isValid(id)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid listing ID."
            );
        }

        return new ObjectId(id);
    }

    private boolean isAvailable(Listing listing) {
        return listing != null
                && listing.getStatus() == ListingStatus.AVAILABLE;
    }

    private SavedListingResponse toResponse(
            SavedListing saved,
            Listing listing
    ) {
        if (listing == null) {
            return new SavedListingResponse(
                    saved.getListingId().toHexString(),
                    "Listing no longer available",
                    "Unavailable",
                    null,
                    null,
                    "DELETED",
                    false,
                    saved.getSavedAt()
            );
        }

        return new SavedListingResponse(
                listing.getId().toHexString(),
                listing.getTitle(),
                listing.getCategory(),
                listing.getPrice(),
                listing.getImageUrl(),
                listing.getStatus() == null
                        ? "UNKNOWN"
                        : listing.getStatus().name(),
                isAvailable(listing),
                saved.getSavedAt()
        );
    }

    public List<SavedListingResponse> getSavedListings(
            String email,
            String filter
    ) {
        User user = getUser(email);

        String selectedFilter = filter == null
                ? "all"
                : filter.trim().toLowerCase(Locale.ROOT);

        if (!selectedFilter.equals("all")
                && !selectedFilter.equals("available")
                && !selectedFilter.equals("unavailable")) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Filter must be all, available, or unavailable."
            );
        }

        List<SavedListing> saved =
                savedRepository.findByUserIdOrderBySavedAtDesc(
                        user.getId()
                );

        List<SavedListingResponse> results = new ArrayList<>();

        for (SavedListing bookmark : saved) {

            Listing listing = listingRepository
                    .findById(bookmark.getListingId())
                    .orElse(null);

            boolean available = isAvailable(listing);

            if (selectedFilter.equals("available") && !available) {
                continue;
            }

            if (selectedFilter.equals("unavailable") && available) {
                continue;
            }

            results.add(toResponse(bookmark, listing));
        }

        return results;
    }

    public SavedListingResponse saveListing(
            String email,
            String listingId
    ) {
        User user = getUser(email);
        ObjectId id = parseId(listingId);

        Listing listing = listingRepository.findById(id)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Listing not found."
                        )
                );

        if (!isAvailable(listing)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This listing is no longer available."
            );
        }

        if (user.getId().equals(listing.getOwnerId())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "You cannot save your own listing."
            );
        }

        SavedListing bookmark = savedRepository
                .findByUserIdAndListingId(user.getId(), id)
                .orElse(null);

        if (bookmark == null) {
            try {
                bookmark = savedRepository.save(
                        new SavedListing(user.getId(), id)
                );
            } catch (DuplicateKeyException ex) {
                bookmark = savedRepository
                        .findByUserIdAndListingId(user.getId(), id)
                        .orElseThrow(() -> ex);
            }
        }

        return toResponse(bookmark, listing);
    }

    public void removeSavedListing(
            String email,
            String listingId
    ) {
        User user = getUser(email);
        ObjectId id = parseId(listingId);

        savedRepository.deleteByUserIdAndListingId(
                user.getId(),
                id
        );
    }

    public long getSavedCount(String email) {
        User user = getUser(email);

        return savedRepository.countByUserId(user.getId());
    }

    public boolean isListingSaved(
            String email,
            String listingId
    ) {
        User user = getUser(email);
        ObjectId id = parseId(listingId);

        return savedRepository.existsByUserIdAndListingId(
                user.getId(),
                id
        );
    }

    public SavedListingResponse getSavedListingStatus(
            String email,
            String listingId
    ) {
        User user = getUser(email);
        ObjectId id = parseId(listingId);

        SavedListing bookmark = savedRepository
                .findByUserIdAndListingId(user.getId(), id)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "This listing is not in your saved items."
                        )
                );

        Listing listing = listingRepository.findById(id)
                .orElse(null);

        return toResponse(bookmark, listing);
    }
}
