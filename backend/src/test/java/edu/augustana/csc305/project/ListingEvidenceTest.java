package edu.augustana.csc305.project;

import edu.augustana.csc305.project.controller.ListingEvidenceController;
import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.*;
import edu.augustana.csc305.project.service.*;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ListingEvidenceTest {
    @TempDir Path directory;
    private final MongoTemplate mongo = mock(MongoTemplate.class);
    private final ListingRepository listings = mock(ListingRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final Map<ObjectId, ListingSnapshot> snapshots = new HashMap<>();
    private final Map<ObjectId, Report> reports = new HashMap<>();
    private final Listing listing = new Listing();
    private final ModerationCase reportCase = ModerationCase.open(new ObjectId(), null);
    private final ObjectId reporter = new ObjectId();
    private static final byte[] IMAGE = {(byte) 255, (byte) 216, (byte) 255, 1, 2, 3};

    private ListingEvidenceService service() throws Exception {
        listing.setId(reportCase.listingId());
        listing.setOwnerId(new ObjectId());
        listing.setTitle("Original title");
        listing.setDescription("Original description");
        listing.setPrice(new BigDecimal("12.50"));
        listing.setCategory("Furniture");
        listing.setVersion(4L);
        String filename = UUID.randomUUID() + ".jpg";
        listing.setImageUrl("/api/v1/images/" + filename);
        Files.write(directory.resolve(filename), IMAGE);
        when(listings.findById(listing.getId())).thenReturn(Optional.of(listing));
        when(users.findById(listing.getOwnerId())).thenReturn(Optional.empty());
        when(mongo.findById(reportCase.id(), ModerationCase.class)).thenReturn(reportCase);
        when(mongo.findById(any(ObjectId.class), eq(ListingSnapshot.class)))
                .thenAnswer(call -> snapshots.get(call.getArgument(0)));
        when(mongo.findById(any(ObjectId.class), eq(Report.class)))
                .thenAnswer(call -> reports.get(call.getArgument(0)));
        when(mongo.insert(any(ListingSnapshot.class))).thenAnswer(call -> {
            ListingSnapshot snapshot = call.getArgument(0);
            snapshots.put(snapshot.id(), snapshot);
            return snapshot;
        });
        when(mongo.insert(any(Report.class))).thenAnswer(call -> {
            Report report = call.getArgument(0);
            reports.put(report.id(), report);
            return report;
        });
        return new ListingEvidenceService(mongo, listings, users, new ImageStorageService(directory.toString(), "/api/v1"));
    }

    private Report report() {
        ObjectId id = new ObjectId();
        return new Report(id, reportCase.id(), reportCase.listingId(), reporter, id,
                ModerationTypes.ReportCategory.OTHER, "Please review", "request", Instant.now());
    }

    @Test
    void retainedTextAndBytesSurviveEditsReplacementStatusChangeAndDeletion() throws Exception {
        var service = service();
        Report report = report();
        ObjectId seller = listing.getOwnerId();
        service.retainAndInsertReport(report, 4L);
        listing.setTitle("Edited");
        listing.setDescription("Edited");
        listing.setPrice(BigDecimal.ZERO);
        listing.setCategory("Changed");
        listing.setStatus(ListingStatus.SOLD);
        listing.setVersion(5L);
        try (var paths = Files.list(directory)) {
            for (Path path : paths.toList()) { Files.write(path, new byte[]{1}); Files.delete(path); }
        }
        when(listings.findById(listing.getId())).thenReturn(Optional.empty());
        ListingSnapshot retained = snapshots.get(report.snapshotId());
        assertEquals("Original title", retained.title());
        assertEquals("Original description", retained.description());
        assertEquals(new BigDecimal("12.50"), retained.price());
        assertEquals("Furniture", retained.category());
        assertEquals(seller, retained.sellerId());
        assertEquals(4L, retained.sourceListingVersion());
        assertArrayEquals(IMAGE, retained.retainedImages().get(0).bytes());
        assertEquals(report, service.retainAndInsertReport(report, 4L));
        assertEquals(1, snapshots.size());
        assertEquals(1, reports.size());
    }

    @Test
    void missingImageDoesNotCreateReportOrPartialSnapshotAndRetrySucceeds() throws Exception {
        var service = service();
        Report report = report();
        Path original = directory.resolve(listing.getImageUrl().substring("/api/v1/images/".length()));
        Files.delete(original);
        assertThrows(ResponseStatusException.class, () -> service.retainAndInsertReport(report, 4L));
        assertTrue(snapshots.isEmpty());
        assertTrue(reports.isEmpty());
        Files.write(original, IMAGE);
        service.retainAndInsertReport(report, 4L);
        service.retainAndInsertReport(report, 4L);
        assertEquals(1, snapshots.size());
        assertEquals(1, reports.size());
        try (var files = Files.list(directory)) { assertEquals(1, files.count()); }
    }

    @Test
    void reportWriteFailureReusesSnapshotEvenAfterOriginalDeletion() throws Exception {
        var service = service();
        Report report = report();
        doThrow(new IllegalStateException("database unavailable")).doReturn(report).when(mongo).insert(report);
        assertThrows(IllegalStateException.class, () -> service.retainAndInsertReport(report, 4L));
        assertEquals(1, snapshots.size());
        assertTrue(reports.isEmpty());
        when(listings.findById(listing.getId())).thenReturn(Optional.empty());
        assertEquals(report, service.retainAndInsertReport(report, 4L));
        assertEquals(1, snapshots.size());
        verify(mongo, times(1)).insert(any(ListingSnapshot.class));
    }

    @Test
    void snapshotWriteFailureNeverCreatesReportAndRetryDoesNotCreateFiles() throws Exception {
        var service = service();
        Report report = report();
        doThrow(new IllegalStateException("snapshot write failed")).when(mongo).insert(any(ListingSnapshot.class));
        assertThrows(IllegalStateException.class, () -> service.retainAndInsertReport(report, 4L));
        assertTrue(snapshots.isEmpty());
        assertTrue(reports.isEmpty());
        verify(mongo, never()).insert(any(Report.class));
        try (var files = Files.list(directory)) { assertEquals(1, files.count()); }
    }

    @Test
    void listingChangedOrDeletedDuringRetentionDoesNotCreateReport() throws Exception {
        var service = service();
        var changed = new Listing();
        changed.setId(listing.getId());
        changed.setVersion(5L);
        when(listings.findById(listing.getId())).thenReturn(Optional.of(listing), Optional.of(changed));
        assertEquals(409, assertThrows(ResponseStatusException.class,
                () -> service.retainAndInsertReport(report(), 4L)).getStatusCode().value());
        when(listings.findById(listing.getId())).thenReturn(Optional.of(listing), Optional.empty());
        assertEquals(409, assertThrows(ResponseStatusException.class,
                () -> service.retainAndInsertReport(report(), 4L)).getStatusCode().value());
        assertTrue(snapshots.isEmpty());
        assertTrue(reports.isEmpty());
    }

    @Test
    void staleListingVersionCreatesNoEvidence() throws Exception {
        var service = service();
        assertEquals(409, assertThrows(ResponseStatusException.class,
                () -> service.retainAndInsertReport(report(), 3L)).getStatusCode().value());
        assertTrue(snapshots.isEmpty());
        assertTrue(reports.isEmpty());
    }

    @Test
    void ordinaryUserAndSellerCannotGuessPrivateSnapshotOrMedia() throws Exception {
        var service = service();
        Report report = report();
        service.retainAndInsertReport(report, 4L);
        var controller = new ListingEvidenceController(mongo, users);
        for (ObjectId id : List.of(reporter, listing.getOwnerId())) {
            User user = new User(id, "Student", "student@augustana.edu", "hash");
            when(users.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
            var auth = new UsernamePasswordAuthenticationToken(user.getEmail(), null, List.of());
            assertEquals(403, assertThrows(ResponseStatusException.class,
                    () -> controller.media(reportCase.id().toHexString(), report.snapshotId().toHexString(), "image", auth))
                    .getStatusCode().value());
            assertEquals(403, assertThrows(ResponseStatusException.class,
                    () -> controller.snapshot(reportCase.id().toHexString(), report.snapshotId().toHexString(), auth))
                    .getStatusCode().value());
        }
    }

    @Test
    void staffCanReadOnlyCaseScopedEvidenceWithoutPublicCaching() throws Exception {
        var service = service();
        Report report = report();
        service.retainAndInsertReport(report, 4L);
        User admin = new User(new ObjectId(), "Staff", "staff@augustana.edu", "hash");
        admin.setRole(UserRole.ADMIN);
        when(users.findByEmail(admin.getEmail())).thenReturn(Optional.of(admin));
        var auth = new UsernamePasswordAuthenticationToken(admin.getEmail(), null, List.of());
        var controller = new ListingEvidenceController(mongo, users);
        var result = controller.media(reportCase.id().toHexString(), report.snapshotId().toHexString(), "image", auth);
        assertArrayEquals(IMAGE, result.getBody());
        assertEquals("no-store", result.getHeaders().getCacheControl());
        admin.setRole(UserRole.MODERATOR);
        assertArrayEquals(IMAGE, controller.media(reportCase.id().toHexString(), report.snapshotId().toHexString(), "image", auth).getBody());
        assertEquals(404, assertThrows(ResponseStatusException.class,
                () -> controller.media(new ObjectId().toHexString(), report.snapshotId().toHexString(), "image", auth))
                .getStatusCode().value());
        assertThrows(ResponseStatusException.class,
                () -> new ImageStorageService(directory.toString(), "/api/v1").getImage("image"));
    }

    @Test
    void concurrentRetryReusesWinningSnapshotAndReport() throws Exception {
        var service = service();
        Report report = report();
        doAnswer(call -> {
            ListingSnapshot snapshot = call.getArgument(0);
            snapshots.put(snapshot.id(), snapshot);
            throw new org.springframework.dao.DuplicateKeyException("concurrent snapshot won");
        }).when(mongo).insert(any(ListingSnapshot.class));
        doAnswer(call -> {
            reports.put(report.id(), report);
            throw new org.springframework.dao.DuplicateKeyException("concurrent report won");
        }).when(mongo).insert(any(Report.class));
        assertEquals(report, service.retainAndInsertReport(report, 4L));
        assertEquals(1, snapshots.size());
        assertEquals(1, reports.size());
        try (var files = Files.list(directory)) { assertEquals(1, files.count()); }
    }

    @Test
    void unauthenticatedSnapshotAndMediaAccessIsDeniedBeforeDatabaseLookup() {
        var controller = new ListingEvidenceController(mongo, users);
        assertEquals(401, assertThrows(ResponseStatusException.class,
                () -> controller.snapshot("guessed", "guessed", null)).getStatusCode().value());
        assertEquals(401, assertThrows(ResponseStatusException.class,
                () -> controller.media("guessed", "guessed", "image", null)).getStatusCode().value());
        verifyNoInteractions(mongo, users);
    }

    @Test
    void imageBytesAreDefensivelyCopiedAndExternalUrlsAreRejected() {
        byte[] bytes = IMAGE.clone();
        RetainedImage retained = new RetainedImage("image", "image/jpeg", bytes);
        bytes[0] = 0;
        retained.bytes()[0] = 0;
        assertArrayEquals(IMAGE, retained.bytes());
        var storage = new ImageStorageService(directory.toString(), "/api/v1");
        assertThrows(IllegalStateException.class, () -> storage.retain("https://example.com/image.jpg"));
        assertThrows(ResponseStatusException.class, () -> storage.retain("/api/v1/images/../secret.jpg"));
    }
}
