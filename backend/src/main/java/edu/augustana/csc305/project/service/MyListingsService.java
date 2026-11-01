
package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.dto.MyListingsResponse;
import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.model.ListingStatus;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.UserRepository;

import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class MyListingsService {

    private final MongoTemplate mongoTemplate;
    private final UserRepository userRepository;
    private final ListingVisibilityPolicy visibility;

    public MyListingsService(
            MongoTemplate mongoTemplate,
            UserRepository userRepository, ListingVisibilityPolicy visibility) {
        this.mongoTemplate = mongoTemplate;
        this.userRepository = userRepository;
        this.visibility = visibility;
    }


    public List<Listing> getMyListings(String email) {
        User user = getUserByEmail(email);

        Query query = new Query(
                Criteria.where("ownerId").is(user.getId())
        );


        query.with(Sort.by(Sort.Direction.DESC, "listedOn"));

        return mongoTemplate.find(query, Listing.class).stream().map(listing -> visibility.view(listing, user)).toList();
    }


    public Listing getMyListing(String id, String email) {
        ObjectId listingId = parseListingId(id);
        User user = getUserByEmail(email);

        Query query = new Query(
                Criteria.where("_id").is(listingId)
                        .and("ownerId").is(user.getId())
        );

        Listing listing = mongoTemplate.findOne(query, Listing.class);

        if (listing == null) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Listing not found."
            );
        }

        return visibility.view(listing, user);
    }


    public void deleteMyListing(String id, String email) {
        ObjectId listingId = parseListingId(id);
        User user = getUserByEmail(email);

        Query query = new Query(
                Criteria.where("_id").is(listingId)
                        .and("ownerId").is(user.getId())
        );

        Listing listing = mongoTemplate.findOne(query, Listing.class);
        if (listing == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found.");
        visibility.requireSellerMutation(listing, user);
        query.addCriteria(Criteria.where("version").is(listing.getVersion()));
        query.addCriteria(visibility.visibleCriteria());
        long deletedCount = mongoTemplate.remove(query, Listing.class).getDeletedCount();

        if (deletedCount == 0) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Listing changed. Refresh before retrying."
            );
        }
    }

    private User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "User not found."
                ));
    }

    private ObjectId parseListingId(String id) {
        if (id == null || !ObjectId.isValid(id)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid listing ID."
            );
        }

        return new ObjectId(id);
    }

    public MyListingsResponse getMyListingsGrouped(String email) {
        User user = getUserByEmail(email);

        Query activeQuery = new Query(
                Criteria.where("ownerId").is(user.getId())
                        .and("status").is(ListingStatus.AVAILABLE)
        );

        Query soldQuery = new Query(
                Criteria.where("ownerId").is(user.getId())
                        .and("status").is(ListingStatus.SOLD)
        );

        activeQuery.with(
                Sort.by(Sort.Direction.DESC, "listedOn")
        );

        soldQuery.with(
                Sort.by(Sort.Direction.DESC, "listedOn")
        );

        List<Listing> activeListings =
                mongoTemplate.find(activeQuery, Listing.class);

        List<Listing> soldListings =
                mongoTemplate.find(soldQuery, Listing.class);

        return new MyListingsResponse(activeListings.stream().map(listing -> visibility.view(listing, user)).toList(),
                soldListings.stream().map(listing -> visibility.view(listing, user)).toList());
    }

}
