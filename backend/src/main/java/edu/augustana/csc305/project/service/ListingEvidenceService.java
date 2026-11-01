package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.ListingRepository;
import edu.augustana.csc305.project.repository.UserRepository;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

/** Server-side integration point for report submission. Caller supplies a stable report/snapshot ID. */
@Service
public class ListingEvidenceService {
    private final MongoTemplate mongo;
    private final ListingRepository listings;
    private final UserRepository users;
    private final ImageStorageService images;

    public ListingEvidenceService(MongoTemplate mongo, ListingRepository listings,
                                  UserRepository users, ImageStorageService images) {
        this.mongo = mongo;
        this.listings = listings;
        this.users = users;
        this.images = images;
    }

    public Report retainAndInsertReport(Report report, Long expectedListingVersion) {
        if (report == null || expectedListingVersion == null || expectedListingVersion < 0
                || report.id() == null || !report.id().equals(report.snapshotId())
                || report.caseId() == null || report.listingId() == null || report.reporterId() == null
                || report.category() == null || report.createdAt() == null) {
            throw new IllegalArgumentException("A complete report and stable matching report/snapshot IDs are required.");
        }
        Report existing = mongo.findById(report.id(), Report.class);
        if (existing != null) return sameReport(existing, report);

        ModerationCase reportCase = mongo.findById(report.caseId(), ModerationCase.class);
        if (reportCase == null || !report.listingId().equals(reportCase.listingId())
                || reportCase.status() == ModerationTypes.CaseStatus.RESOLVED) {
            throw new IllegalArgumentException("An active case for this listing is required.");
        }

        ListingSnapshot snapshot = mongo.findById(report.snapshotId(), ListingSnapshot.class);
        if (snapshot == null) {
            Listing listing = listings.findById(report.listingId()).orElseThrow(() ->
                    new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found."));
            if (!Objects.equals(listing.getVersion(), expectedListingVersion)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Listing changed. Refresh before reporting.");
            }
            // Capture scalars before reading bytes, and recheck the persisted version afterward.
            String imageUrl = listing.getImageUrl();
            String sellerName = users.findById(listing.getOwnerId()).map(User::getName).orElse(null);
            Instant capturedAt = Instant.now();
            snapshot = new ListingSnapshot(report.snapshotId(), report.caseId(), listing.getId(),
                    listing.getOwnerId(), sellerName, listing.getVersion(), listing.getTitle(),
                    listing.getDescription(), listing.getCategory(), listing.getPrice(), listing.getCondition(),
                    listing.getPickupArea(), listing.getListingType(), listing.getStatus(), List.of(), capturedAt,
                    List.of());
            List<RetainedImage> retained = imageUrl == null || imageUrl.isBlank()
                    ? List.of() : List.of(images.retain(imageUrl));
            Listing current = listings.findById(listing.getId()).orElseThrow(() ->
                    new ResponseStatusException(HttpStatus.CONFLICT, "Listing was deleted during retention."));
            if (!Objects.equals(current.getVersion(), snapshot.sourceListingVersion())
                    || !Objects.equals(current.getImageUrl(), imageUrl)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Listing changed during retention. Retry.");
            }
            snapshot = new ListingSnapshot(snapshot.id(), snapshot.caseId(), snapshot.listingId(),
                    snapshot.sellerId(), snapshot.sellerDisplayName(), snapshot.sourceListingVersion(), snapshot.title(),
                    snapshot.description(), snapshot.category(), snapshot.price(), snapshot.condition(),
                    snapshot.pickupArea(), snapshot.listingType(), snapshot.lifecycleStatus(),
                    retained.stream().map(RetainedImage::key).toList(), snapshot.capturedAt(), retained);
            try {
                mongo.insert(snapshot); // Metadata and bytes persist atomically in one BSON document.
            } catch (DuplicateKeyException concurrentRetry) {
                snapshot = mongo.findById(report.snapshotId(), ListingSnapshot.class);
                if (snapshot == null) throw concurrentRetry;
            }
        }
        if (!report.caseId().equals(snapshot.caseId()) || !report.listingId().equals(snapshot.listingId())
                || !Objects.equals(expectedListingVersion, snapshot.sourceListingVersion())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Snapshot ID already belongs to different evidence.");
        }
        try {
            return mongo.insert(report); // Never insert a report before complete evidence exists.
        } catch (DuplicateKeyException concurrentRetry) {
            Report saved = mongo.findById(report.id(), Report.class);
            if (saved == null) throw concurrentRetry;
            return sameReport(saved, report);
        }
    }

    private Report sameReport(Report saved, Report requested) {
        // Ignore timestamps on retry, but never let another reporter reuse an ID.
        if (!Objects.equals(saved.reporterId(), requested.reporterId())
                || !Objects.equals(saved.caseId(), requested.caseId())
                || !Objects.equals(saved.listingId(), requested.listingId())
                || !Objects.equals(saved.snapshotId(), requested.snapshotId())
                || saved.category() != requested.category()
                || !Objects.equals(saved.description(), requested.description())
                || !Objects.equals(saved.requestId(), requested.requestId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Report ID already used.");
        }
        return saved;
    }
}
