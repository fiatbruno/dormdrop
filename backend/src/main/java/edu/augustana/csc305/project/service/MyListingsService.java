
package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.repository.ListingRepository;
import org.bson.types.ObjectId;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class MyListingsService {

    private final ListingRepository listingRepository;

    public MyListingsService(ListingRepository listingRepository) {
        this.listingRepository = listingRepository;
    }

    public List<Listing> getMyListings(String email) {
        return listingRepository
                .findAllByOwnerEmailIgnoreCaseOrderByCreatedAtDesc(email);
    }

    public Listing getMyListing(String email, String id) {
        ObjectId objectId = parseId(id);

        return listingRepository
                .findByIdAndOwnerEmailIgnoreCase(objectId, email)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Listing not found"
                ));
    }

    public void deleteMyListing(String email, String id) {
        ObjectId objectId = parseId(id);

        if (!listingRepository
                .existsByIdAndOwnerEmailIgnoreCase(objectId, email)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Listing not found"
            );
        }

        listingRepository.deleteByIdAndOwnerEmailIgnoreCase(
                objectId, email
        );
    }

    private ObjectId parseId(String id) {
        if (!ObjectId.isValid(id)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Listing not found"
            );
        }

        return new ObjectId(id);
    }
}
