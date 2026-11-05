package edu.augustana.csc305.project;

import com.mongodb.client.result.UpdateResult;
import edu.augustana.csc305.project.controller.ReportController;
import edu.augustana.csc305.project.dto.*;
import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.UserRepository;
import edu.augustana.csc305.project.service.*;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.*;

import static edu.augustana.csc305.project.model.ModerationTypes.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ReportSubmissionTest {
    private final MongoTemplate mongo = mock(MongoTemplate.class);
    private final UserRepository users = mock(UserRepository.class);
    private final ListingEvidenceService evidence = mock(ListingEvidenceService.class);
    private final TransactionOperations transactions = mock(TransactionOperations.class);
    private final User user = new User(new ObjectId(), "Reporter", "reporter@augustana.edu", "hash");
    private final Listing listing = new Listing();
    private ModerationCase active;
    private final String key = "request-1";
    private final SubmitReportRequest body = new SubmitReportRequest("OTHER", "Review this listing");
    private final UsernamePasswordAuthenticationToken auth =
            new UsernamePasswordAuthenticationToken(user.getEmail(), null, List.of());

    private ReportSubmissionService service() {
        return new ReportSubmissionService(mongo, users, evidence, transactions, 2, 3600);
    }

    ReportSubmissionTest() {
        user.setEmailVerified(true);
        listing.setId(new ObjectId());
        listing.setOwnerId(new ObjectId());
        listing.setVersion(4L);
        var draft = ModerationCase.open(listing.getId(), null);
        active = new ModerationCase(draft.id(), draft.referenceNumber(), draft.listingId(), null,
                CaseStatus.OPEN, Priority.MEDIUM, null, draft.createdAt(), draft.updatedAt(), 0L);
        when(users.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(mongo.findById(listing.getId(), Listing.class)).thenReturn(listing);
        when(mongo.findOne(any(Query.class), eq(ModerationCase.class))).thenAnswer(call -> active);
        when(mongo.findById(any(ObjectId.class), eq(ModerationCase.class))).thenAnswer(call -> active);
        when(mongo.updateFirst(any(Query.class), any(Update.class), eq(ModerationCase.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));
        when(mongo.updateFirst(any(Query.class), any(Update.class), eq(Listing.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));
        when(transactions.execute(any())).thenAnswer(call ->
                ((TransactionCallback<?>) call.getArgument(0)).doInTransaction(mock(TransactionStatus.class)));
    }

    private Report report() {
        ObjectId id = new ObjectId();
        return new Report(id, active.id(), listing.getId(), user.getId(), id, ReportCategory.OTHER,
                body.description(), requestId(), Instant.now());
    }

    private String requestId() { return user.getId().toHexString() + ":" + key; }

    @Test
    void rejectsOwnListingWithoutSavingOrConsumingQuota() {
        listing.setOwnerId(user.getId());
        var failure = assertThrows(ResponseStatusException.class,
                () -> service().submit(listing.getId().toHexString(), body, key, auth));
        assertEquals(403, failure.getStatusCode().value());
        assertEquals("You cannot report your own listing.", failure.getReason());
        verifyNoInteractions(evidence);
        verify(mongo, never()).insert(any(ReportRateWindow.class));
        verify(mongo, never()).insert(any(ReportRequest.class));
        verify(mongo, never()).insert(any(ModerationCase.class));
    }

    @Test
    void acceptsReportThroughRetentionAndNeverHidesOrChangesLifecycle() {
        var result = service().submit(listing.getId().toHexString(), body, key, auth);
        assertTrue(result.created());
        verify(evidence).retainAndInsertReport(argThat(report -> report.reporterId().equals(user.getId())
                && report.snapshotId().equals(report.id()) && report.caseId().equals(active.id())), eq(4L));
        verify(mongo).insert(any(ReportRequest.class));
        verify(mongo).insert(any(ReportRateWindow.class));
        var update = org.mockito.ArgumentCaptor.forClass(Update.class);
        verify(mongo).updateFirst(any(Query.class), update.capture(), eq(Listing.class));
        assertFalse(update.getValue().getUpdateObject().toJson().contains("moderationVisibility"));
        assertFalse(update.getValue().getUpdateObject().toJson().contains("status"));
        assertEquals(Visibility.VISIBLE, listing.getModerationVisibility());
        assertEquals(ListingStatus.AVAILABLE, listing.getStatus());
    }

    @Test
    void identicalRequestRetryWorksAfterListingDeletionAndDoesNotConsumeQuota() {
        Report report = report();
        when(mongo.findById(requestId(), ReportRequest.class)).thenReturn(new ReportRequest(requestId(),
                listing.getId(), ReportCategory.OTHER, body.description(), report.id(), Instant.now()));
        when(mongo.findById(report.id(), Report.class)).thenReturn(report);
        when(mongo.findById(listing.getId(), Listing.class)).thenReturn(null);
        assertFalse(service().submit(listing.getId().toHexString(), body, key, auth).created());
        verifyNoInteractions(evidence);
        verify(mongo, never()).insert(any(ReportRateWindow.class));
        verify(mongo, never()).insert(any(ReportRequest.class));
    }

    @Test
    void sameReporterWithDifferentKeyIsRejectedWithoutCreatingRequestAliases() {
        Report report = report();
        when(mongo.findOne(any(Query.class), eq(Report.class))).thenReturn(report);
        var conflict = assertThrows(ReportSubmissionService.ReportConflict.class,
                () -> service().submit(listing.getId().toHexString(), body, key, auth));
        assertEquals(409, conflict.getStatusCode().value());
        assertEquals(report.id().toHexString(), conflict.existingReport().reportId());
        verifyNoInteractions(evidence);
        verify(mongo, never()).insert(any(ReportRateWindow.class));
        verify(mongo, never()).insert(any(ReportRequest.class));
    }

    @Test
    void changedReasonReturnsExplicitNotSavedResponse() throws Exception {
        Report original = report();
        when(mongo.findOne(any(Query.class), eq(Report.class))).thenReturn(original);
        var mvc = MockMvcBuilders.standaloneSetup(new ReportController(service())).build();
        String response = mvc.perform(post("/home/"+listing.getId()+"/reports").principal(auth)
                .header("Idempotency-Key", "another-key").contentType("application/json")
                .content("{\"category\":\"SUSPECTED_SCAM\",\"description\":\"Different details\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("REPORT_ALREADY_EXISTS"))
                .andExpect(jsonPath("$.detailsSaved").value(false))
                .andExpect(jsonPath("$.report.reportId").value(original.id().toHexString()))
                .andReturn().getResponse().getContentAsString();
        assertTrue(response.contains("were not saved"));
        assertFalse(response.contains("Different details"));
        verify(mongo, never()).insert(any(ReportRequest.class));
        verifyNoInteractions(evidence);
    }

    @Test
    void reusedKeyWithChangedDetailsAlsoReturnsExplicitNotSavedResponse() throws Exception {
        when(mongo.findById(requestId(), ReportRequest.class)).thenReturn(new ReportRequest(requestId(),
                listing.getId(), ReportCategory.OTHER, "Original details", new ObjectId(), Instant.now()));
        var mvc = MockMvcBuilders.standaloneSetup(new ReportController(service())).build();
        mvc.perform(post("/home/"+listing.getId()+"/reports").principal(auth)
                .header("Idempotency-Key", key).contentType("application/json")
                .content("{\"category\":\"OTHER\",\"description\":\"Changed details\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REUSED"))
                .andExpect(jsonPath("$.detailsSaved").value(false));
        verifyNoInteractions(evidence);
    }

    @Test
    void requestKeyCannotBeReusedWithDifferentPayloadOrListing() {
        when(mongo.findById(requestId(), ReportRequest.class)).thenReturn(new ReportRequest(requestId(),
                listing.getId(), ReportCategory.OTHER, "different", new ObjectId(), Instant.now()));
        assertStatus(409, () -> service().submit(listing.getId().toHexString(), body, key, auth));
        verifyNoInteractions(evidence);
    }

    @Test
    void requiresAuthenticatedVerifiedPersistedReporterForBothEndpoints() {
        assertStatus(401, () -> service().submit(listing.getId().toHexString(), body, key, null));
        assertStatus(401, () -> service().ownReports(null, 0, 20));
        user.setEmailVerified(false);
        assertStatus(403, () -> service().submit(listing.getId().toHexString(), body, key, auth));
        assertStatus(403, () -> service().ownReports(auth, 0, 20));
        when(users.findByEmail(user.getEmail())).thenReturn(Optional.empty());
        assertStatus(401, () -> service().submit(listing.getId().toHexString(), body, key, auth));
        verifyNoInteractions(evidence, transactions);
    }

    @Test
    void rejectsBadCategoryTextKeyAndListingId() {
        assertStatus(400, () -> service().submit("bad-id", body, key, auth));
        assertStatus(400, () -> service().submit(listing.getId().toHexString(), body, "invalid key", auth));
        assertStatus(400, () -> service().submit(listing.getId().toHexString(), body, null, auth));
        for (var invalid : List.of(new SubmitReportRequest("INVALID", "text"),
                new SubmitReportRequest("OTHER", " "), new SubmitReportRequest("OTHER", "x".repeat(2001)))) {
            assertStatus(400, () -> service().submit(listing.getId().toHexString(), invalid, key, auth));
        }
        verifyNoInteractions(evidence, transactions);
    }

    @Test
    void rejectsUnavailableHiddenRemovedAndDeletedListings() {
        for (ListingStatus status : List.of(ListingStatus.SOLD, ListingStatus.DONATED, ListingStatus.RESERVED)) {
            listing.setStatus(status);
            assertStatus(404, () -> service().submit(listing.getId().toHexString(), body, key, auth));
        }
        listing.setStatus(ListingStatus.AVAILABLE);
        for (Visibility visibility : List.of(Visibility.HIDDEN, Visibility.REMOVED)) {
            listing.setModerationVisibility(visibility);
            assertStatus(404, () -> service().submit(listing.getId().toHexString(), body, key, auth));
        }
        when(mongo.findById(listing.getId(), Listing.class)).thenReturn(null);
        assertStatus(404, () -> service().submit(listing.getId().toHexString(), body, key, auth));
        verifyNoInteractions(evidence);
    }

    @Test
    void exceededRateLimitReturns429AndRetryAfterWithoutRetainingEvidence() {
        when(mongo.findById(user.getId(), ReportRateWindow.class))
                .thenReturn(new ReportRateWindow(user.getId(), Instant.now(), 2));
        var exception = assertThrows(ReportSubmissionService.RateLimitExceeded.class,
                () -> service().submit(listing.getId().toHexString(), body, key, auth));
        var response = new ReportController(service()).limited(exception);
        assertEquals(429, response.getStatusCode().value());
        assertTrue(Long.parseLong(response.getHeaders().getFirst("Retry-After")) > 0);
        verifyNoInteractions(evidence);
    }

    @Test
    void expiredRateWindowResetsCount() {
        when(mongo.findById(user.getId(), ReportRateWindow.class))
                .thenReturn(new ReportRateWindow(user.getId(), Instant.now().minusSeconds(3601), 2));
        assertTrue(service().submit(listing.getId().toHexString(), body, key, auth).created());
        verify(mongo).save(argThat((ReportRateWindow window) -> window.count() == 1));
    }

    @Test
    void ownStatusQueriesOnlyReporterAndUsesSanitizedContract() {
        Report report = report();
        when(mongo.find(any(Query.class), eq(Report.class))).thenAnswer(call -> {
            Query query = call.getArgument(0);
            assertEquals(user.getId(), query.getQueryObject().get("reporterId"));
            assertEquals(20, query.getLimit());
            return List.of(report);
        });
        var result = service().ownReports(auth, 0, 20);
        assertEquals(1, result.size());
        assertEquals(List.of("reportId", "referenceNumber", "status", "submittedAt"),
                Arrays.stream(ModerationDtos.ReporterStatus.class.getRecordComponents()).map(c -> c.getName()).toList());
        assertStatus(400, () -> service().ownReports(auth, -1, 20));
        assertStatus(400, () -> service().ownReports(auth, 0, 101));
    }

    @Test
    void httpSuccessAndOwnHistorySerializeOnlySanitizedStatusFields() throws Exception {
        Report report = report();
        when(mongo.find(any(Query.class), eq(Report.class))).thenReturn(List.of(report));
        var mvc = MockMvcBuilders.standaloneSetup(new ReportController(service())).build();
        String postJson = mvc.perform(post("/home/" + listing.getId().toHexString() + "/reports")
                .principal(auth).contentType("application/json").header("Idempotency-Key", key)
                .content("{\"category\":\"OTHER\",\"description\":\"Review this listing\"}"))
                .andExpect(status().isCreated()).andExpect(header().string("Cache-Control", "no-store"))
                .andReturn().getResponse().getContentAsString();
        String ownJson = mvc.perform(get("/me/reports").principal(auth)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        for (String json : List.of(postJson, ownJson)) {
            assertTrue(json.contains("referenceNumber"));
            for (String forbidden : List.of("reporterId", "internalRationale", "snapshotId", "privateEvidenceKeys",
                    "staffId", "internalNote", "description")) assertFalse(json.contains(forbidden));
        }
    }

    @Test
    void retriesTransientTransactionFailureAndReturns503OnPermanentDatabaseFailure() {
        var transientCause = new com.mongodb.MongoException(112, "write conflict");
        doThrow(new org.springframework.transaction.TransactionSystemException("aborted", transientCause))
                .doAnswer(call -> ((TransactionCallback<?>) call.getArgument(0))
                        .doInTransaction(mock(TransactionStatus.class)))
                .when(transactions).execute(any());
        assertTrue(service().submit(listing.getId().toHexString(), body, key, auth).created());
        verify(transactions, times(2)).execute(any());
        doThrow(new org.springframework.dao.DataAccessResourceFailureException("unavailable"))
                .when(transactions).execute(any());
        assertStatus(503, () -> service().submit(listing.getId().toHexString(), body, key, auth));
    }

    @Test
    void httpValidatesBodiesAndHeadersAndRejectsUnauthenticatedAndUnverifiedRequests() throws Exception {
        var mvc = MockMvcBuilders.standaloneSetup(new ReportController(service())).build();
        String path = "/home/" + listing.getId().toHexString() + "/reports";
        mvc.perform(post(path).contentType("application/json").header("Idempotency-Key", key)
                .content("{\"category\":\"OTHER\",\"description\":\"text\"}")).andExpect(status().isUnauthorized());
        user.setEmailVerified(false);
        mvc.perform(post(path).principal(auth).contentType("application/json").header("Idempotency-Key", key)
                .content("{\"category\":\"OTHER\",\"description\":\"text\"}")).andExpect(status().isForbidden());
        mvc.perform(post(path).principal(auth).contentType("application/json")
                .content("{\"category\":\"OTHER\",\"description\":\"text\"}")).andExpect(status().isBadRequest());
        mvc.perform(post(path).principal(auth).contentType("application/json").header("Idempotency-Key", key)
                .content("{\"category\":\"OTHER\",\"description\":\"\"}")).andExpect(status().isBadRequest());
    }

    private void assertStatus(int status, org.junit.jupiter.api.function.Executable work) {
        assertEquals(status, assertThrows(ResponseStatusException.class, work).getStatusCode().value());
    }
}
