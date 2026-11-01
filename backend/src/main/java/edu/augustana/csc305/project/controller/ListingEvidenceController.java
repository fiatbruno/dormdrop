package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.UserRepository;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/staff/cases/{caseId}/snapshots")
public class ListingEvidenceController {
    private final MongoTemplate mongo;
    private final UserRepository users;

    public ListingEvidenceController(MongoTemplate mongo, UserRepository users) {
        this.mongo = mongo;
        this.users = users;
    }

    public record SnapshotView(String id, String listingId, String sellerId, Long listingVersion,
                               String title, String description, BigDecimal price, String category,
                               ListingStatus lifecycleStatus, Instant capturedAt, List<String> mediaKeys) {}

    private ListingSnapshot authorizedSnapshot(String caseId, String snapshotId, Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required.");
        }
        User user = users.findByEmail(auth.getName()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found."));
        if (!edu.augustana.csc305.project.security.StaffAccess.permits(user.getRole(),
                edu.augustana.csc305.project.security.StaffAccess.Capability.REVIEW_CASES)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff access required.");
        }
        if (!ObjectId.isValid(caseId) || !ObjectId.isValid(snapshotId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Evidence not found.");
        }
        ObjectId caseObjectId = new ObjectId(caseId);
        ListingSnapshot snapshot = mongo.findById(new ObjectId(snapshotId), ListingSnapshot.class);
        if (snapshot == null || !caseObjectId.equals(snapshot.caseId())
                || mongo.findById(caseObjectId, ModerationCase.class) == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Evidence not found.");
        }
        return snapshot;
    }

    @GetMapping("/{snapshotId}")
    public ResponseEntity<SnapshotView> snapshot(@PathVariable String caseId, @PathVariable String snapshotId,
                                                Authentication auth) {
        ListingSnapshot snapshot = authorizedSnapshot(caseId, snapshotId, auth);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new SnapshotView(
                snapshot.id().toHexString(), snapshot.listingId().toHexString(), snapshot.sellerId().toHexString(),
                snapshot.sourceListingVersion(), snapshot.title(), snapshot.description(), snapshot.price(),
                snapshot.category(), snapshot.lifecycleStatus(), snapshot.capturedAt(), snapshot.privateEvidenceKeys()));
    }

    @GetMapping("/{snapshotId}/media/{key}")
    public ResponseEntity<byte[]> media(@PathVariable String caseId, @PathVariable String snapshotId,
                                        @PathVariable String key, Authentication auth) {
        ListingSnapshot snapshot = authorizedSnapshot(caseId, snapshotId, auth);
        RetainedImage image = snapshot.retainedImages().stream().filter(item -> item.key().equals(key))
                .findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evidence not found."));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.parseMediaType(image.contentType())).body(image.bytes());
    }
}
