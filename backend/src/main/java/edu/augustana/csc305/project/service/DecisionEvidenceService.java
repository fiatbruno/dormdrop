package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.UserRepository;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.util.List;

@Service
public class DecisionEvidenceService {
    private final MongoTemplate mongo;
    private final UserRepository users;
    private final ImageStorageService images;
    public DecisionEvidenceService(MongoTemplate mongo, UserRepository users, ImageStorageService images) {
        this.mongo = mongo; this.users = users; this.images = images;
    }
    /** Called inside the command transaction. Existing report evidence is never overwritten or deleted. */
    public ListingSnapshot retain(ObjectId decisionId, ModerationCase reportCase, Listing listing) {
        ListingSnapshot retained = mongo.findOne(Query.query(Criteria.where("caseId").is(reportCase.id())
                .and("listingId").is(reportCase.listingId()))
                .with(Sort.by(Sort.Order.desc("capturedAt"), Sort.Order.desc("_id"))), ListingSnapshot.class);
        if (retained != null) return retained;
        if (listing == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "Listing was deleted and retained evidence is missing.");
        List<RetainedImage> media = listing.getImageUrl() == null || listing.getImageUrl().isBlank()
                ? List.of() : List.of(images.retain(listing.getImageUrl()));
        String sellerName = listing.getOwnerId() == null ? null : users.findById(listing.getOwnerId()).map(User::getName).orElse(null);
        return mongo.insert(new ListingSnapshot(decisionId, reportCase.id(), listing.getId(), listing.getOwnerId(),
                sellerName, listing.getVersion(), listing.getTitle(), listing.getDescription(), listing.getCategory(),
                listing.getPrice(), listing.getCondition(), listing.getPickupArea(), listing.getListingType(),
                listing.getStatus(), media.stream().map(RetainedImage::key).toList(), Instant.now(), media));
    }
}
