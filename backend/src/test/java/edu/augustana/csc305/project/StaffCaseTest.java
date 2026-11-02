package edu.augustana.csc305.project;

import edu.augustana.csc305.project.controller.StaffCaseController;
import edu.augustana.csc305.project.dto.StaffCaseDtos.*;
import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.UserRepository;
import edu.augustana.csc305.project.security.StaffAccess;
import edu.augustana.csc305.project.service.StaffCaseService;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.*;
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
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class StaffCaseTest {
    private final MongoTemplate mongo = mock(MongoTemplate.class);
    private final UserRepository users = mock(UserRepository.class);
    private final TransactionOperations transactions = mock(TransactionOperations.class);
    private final User staff = new User(new ObjectId(), "Staff", "staff@augustana.edu", "secret-hash");
    private final UsernamePasswordAuthenticationToken auth =
            new UsernamePasswordAuthenticationToken(staff.getEmail(), null, List.of());
    private final ModerationCase reportCase;
    private final StaffCaseService service;

    StaffCaseTest() {
        staff.setRole(UserRole.MODERATOR);
        when(users.findByEmail(staff.getEmail())).thenReturn(Optional.of(staff));
        when(users.findById(staff.getId())).thenReturn(Optional.of(staff));
        var draft = ModerationCase.open(new ObjectId(), null);
        reportCase = new ModerationCase(draft.id(), draft.referenceNumber(), draft.listingId(), null,
                CaseStatus.OPEN, Priority.HIGH, null, draft.createdAt(), draft.updatedAt(), 0L);
        when(mongo.findById(reportCase.id(), ModerationCase.class)).thenReturn(reportCase);
        when(transactions.execute(any())).thenAnswer(call ->
                ((TransactionCallback<?>)call.getArgument(0)).doInTransaction(mock(TransactionStatus.class)));
        when(mongo.find(any(Query.class), eq(Report.class))).thenReturn(List.of());
        when(mongo.find(any(Query.class), eq(ListingSnapshot.class))).thenReturn(List.of());
        when(mongo.find(any(Query.class), eq(ModerationDecision.class))).thenReturn(List.of());
        when(mongo.find(any(Query.class), eq(ActivityEvent.class))).thenReturn(List.of());
        service = new StaffCaseService(mongo, users, new StaffAccess(users), transactions);
    }

    private String caseId() { return reportCase.id().toHexString(); }
    private void assertStatus(int expected, org.junit.jupiter.api.function.Executable work) {
        assertEquals(expected, assertThrows(ResponseStatusException.class, work).getStatusCode().value());
    }

    @Test
    void anonymousAndStudentCannotReviewOrAssignAndDemotionTakesEffectImmediately() {
        assertStatus(401, () -> service.queue(null, null, null, 0, 20));
        assertStatus(401, () -> service.detail(null, caseId()));
        assertStatus(401, () -> service.assign(null, caseId(), new Assignment(0L, null)));
        staff.setRole(UserRole.STUDENT);
        assertStatus(403, () -> service.queue(auth, null, null, 0, 20));
        assertStatus(403, () -> service.detail(auth, caseId()));
        assertStatus(403, () -> service.assign(auth, caseId(), new Assignment(0L, null)));
        verifyNoInteractions(mongo, transactions);
    }

    @Test
    void moderatorAndAdminHaveReviewCapabilitiesAndLegacyStudentDoesNot() {
        for (UserRole role : List.of(UserRole.MODERATOR, UserRole.ADMIN)) {
            staff.setRole(role);
            assertEquals(caseId(), service.detail(auth, caseId()).caseSummary().caseId());
        }
        staff.setRole(null);
        assertStatus(403, () -> service.detail(auth, caseId()));
        assertFalse(StaffAccess.permits(UserRole.MODERATOR, null));
    }

    @Test
    void queueSharesFiltersForCountAndPageWithStableTieBreaker() {
        when(mongo.count(any(Query.class), eq(ModerationCase.class))).thenReturn(3L);
        when(mongo.count(any(Query.class), eq(Report.class))).thenReturn(7L);
        when(mongo.find(any(Query.class), eq(ModerationCase.class))).thenReturn(List.of(reportCase));
        QueuePage page = service.queue(auth, CaseStatus.OPEN, Priority.HIGH, 1, 2);
        assertEquals(3, page.total());
        assertEquals(2, page.totalPages());
        assertEquals(7, page.items().get(0).reportCount());
        var count = ArgumentCaptor.forClass(Query.class);
        var find = ArgumentCaptor.forClass(Query.class);
        verify(mongo).count(count.capture(), eq(ModerationCase.class));
        verify(mongo).find(find.capture(), eq(ModerationCase.class));
        assertEquals(count.getValue().getQueryObject(), find.getValue().getQueryObject());
        assertEquals(CaseStatus.OPEN, find.getValue().getQueryObject().get("status"));
        assertEquals(Priority.HIGH, find.getValue().getQueryObject().get("priority"));
        assertEquals(2, find.getValue().getSkip());
        assertEquals(2, find.getValue().getLimit());
        assertEquals(List.of("createdAt", "_id"), new ArrayList<>(find.getValue().getSortObject().keySet()));
        assertStatus(400, () -> service.queue(auth, null, null, -1, 20));
        assertStatus(400, () -> service.queue(auth, null, null, 0, 101));
    }

    @Test
    void detailScopesEveryCollectionToCaseAndNeverLoadsMemberDirectoryOrMessages() {
        var detail = service.detail(auth, caseId());
        assertNull(detail.seller());
        assertTrue(detail.reportGroups().isEmpty());
        for (Class<?> type : List.of(Report.class, ListingSnapshot.class, ModerationDecision.class, ActivityEvent.class)) {
            verify(mongo).find(argThat((Query query) -> reportCase.id().equals(query.getQueryObject().get("caseId"))), eq(type));
        }
        verify(users, never()).findById(any());
        verify(mongo, never()).find(any(Query.class), eq(User.class));
        verify(mongo, never()).find(any(Query.class), eq(Message.class));
    }

    @Test
    void claimChecksExpectedVersionAndAppendsActivity() {
        ModerationCase updated = new ModerationCase(reportCase.id(), reportCase.referenceNumber(), reportCase.listingId(),
                null, CaseStatus.IN_REVIEW, Priority.HIGH, staff.getId(), reportCase.createdAt(), Instant.now(), 1L);
        when(mongo.findAndModify(any(Query.class), any(Update.class), any(FindAndModifyOptions.class), eq(ModerationCase.class)))
                .thenReturn(updated);
        assertEquals(1L, service.assign(auth, caseId(), new Assignment(0L, null)).version());
        var query = ArgumentCaptor.forClass(Query.class);
        var update = ArgumentCaptor.forClass(Update.class);
        verify(mongo).findAndModify(query.capture(), update.capture(), any(FindAndModifyOptions.class), eq(ModerationCase.class));
        assertEquals(0L, query.getValue().getQueryObject().get("version"));
        assertTrue(query.getValue().getQueryObject().containsKey("$or"));
        assertTrue(update.getValue().getUpdateObject().get("$inc", org.bson.Document.class).containsKey("version"));
        verify(mongo).insert(argThat((ActivityEvent event) -> event.caseId().equals(reportCase.id())
                && event.actorId().equals(staff.getId()) && event.expectedCaseVersion() == 0));
    }

    @Test
    void staleAndMissingVersionsOrIneligibleAssigneesAreRejected() {
        assertStatus(409, () -> service.assign(auth, caseId(), new Assignment(0L, null)));
        verify(mongo, never()).insert(any(ActivityEvent.class));
        assertStatus(400, () -> service.assign(auth, caseId(), new Assignment(null, null)));
        assertStatus(400, () -> service.assign(auth, caseId(), new Assignment(-1L, null)));
        User student = new User(new ObjectId(), "Student", "student@augustana.edu", "hash");
        when(users.findById(student.getId())).thenReturn(Optional.of(student));
        assertStatus(400, () -> service.assign(auth, caseId(), new Assignment(0L, student.getId().toHexString())));
        assertStatus(404, () -> service.detail(auth, new ObjectId().toHexString()));
    }

    @Test
    void groupedDetailReturnsRetainedMetadataAndOnlyLimitedSellerContext() {
        ObjectId snapshotId = new ObjectId();
        ObjectId sellerId = new ObjectId();
        Report report = new Report(new ObjectId(), reportCase.id(), reportCase.listingId(), new ObjectId(), snapshotId,
                ReportCategory.OTHER, "Reported issue", "request", Instant.now());
        var snapshot = new ListingSnapshot(snapshotId, reportCase.id(), reportCase.listingId(), sellerId, "Seller name",
                3L, "Retained title", "Retained text", "Furniture", new java.math.BigDecimal("10.50"),
                "Good", "Campus", "For sale", ListingStatus.AVAILABLE, List.of("image"), Instant.now(),
                List.of(new RetainedImage("image", "image/jpeg", new byte[]{1,2,3})));
        when(mongo.find(any(Query.class), eq(Report.class))).thenReturn(List.of(report));
        when(mongo.find(any(Query.class), eq(ListingSnapshot.class))).thenAnswer(call -> {
            Query query = call.getArgument(0);
            assertEquals(reportCase.id(), query.getQueryObject().get("caseId"));
            assertEquals(reportCase.listingId(), query.getQueryObject().get("listingId"));
            assertTrue(((Collection<?>) query.getQueryObject().get("_id", org.bson.Document.class).get("$in")).contains(snapshotId));
            assertEquals(0, query.getFieldsObject().get("retainedImages"));
            return List.of(snapshot);
        });
        var detail = service.detail(auth, caseId());
        assertEquals(1, detail.reportGroups().size());
        assertEquals(snapshotId.toHexString(), detail.reportGroups().get(0).snapshotId());
        assertEquals("Retained title", detail.snapshots().get(0).title());
        assertEquals("Retained text", detail.snapshots().get(0).description());
        assertEquals(new java.math.BigDecimal("10.50"), detail.snapshots().get(0).price());
        assertEquals(List.of("sellerId", "displayName"), Arrays.stream(SellerContext.class.getRecordComponents())
                .map(component -> component.getName()).toList());
        verify(users, never()).findById(any());
    }

    @Test
    void concurrentTransactionWriteConflictReturns409() {
        doThrow(new org.springframework.transaction.TransactionSystemException("conflict",
                new com.mongodb.MongoException(112, "write conflict"))).when(transactions).execute(any());
        assertStatus(409, () -> service.assign(auth, caseId(), new Assignment(0L, null)));
        verify(mongo, never()).insert(any(ActivityEvent.class));
    }

    @Test
    void moderatorCannotReadUnrelatedConversations() {
        var conversations = mock(edu.augustana.csc305.project.repository.ConversationRepository.class);
        var messages = mock(edu.augustana.csc305.project.repository.MessageRepository.class);
        var conversation = new Conversation(new ObjectId(), new ObjectId(), new ObjectId());
        conversation.setId(new ObjectId());
        when(conversations.findById(conversation.getId())).thenReturn(Optional.of(conversation));
        var service = new edu.augustana.csc305.project.service.ConversationService(conversations, users, mongo, messages,
                new edu.augustana.csc305.project.service.ListingVisibilityPolicy());
        assertStatus(403, () -> service.getConversation(conversation.getId().toHexString(), staff.getEmail()));
        verifyNoInteractions(messages);
    }

    @Test
    void httpChecksCapabilitiesFiltersAndRequiredVersion() throws Exception {
        var mvc = MockMvcBuilders.standaloneSetup(new StaffCaseController(service)).build();
        mvc.perform(get("/admin/reports")).andExpect(status().isUnauthorized());
        staff.setRole(UserRole.STUDENT);
        mvc.perform(get("/admin/reports").principal(auth)).andExpect(status().isForbidden());
        staff.setRole(UserRole.MODERATOR);
        mvc.perform(get("/admin/reports").principal(auth).param("status", "INVALID")).andExpect(status().isBadRequest());
        mvc.perform(patch("/admin/reports/" + caseId() + "/assignment").principal(auth)
                .contentType("application/json").content("{}")).andExpect(status().isBadRequest());
        mvc.perform(patch("/admin/reports/" + caseId() + "/assignment").principal(auth)
                .contentType("application/json").content("{\"expectedVersion\":0}")).andExpect(status().isConflict());
    }
}
