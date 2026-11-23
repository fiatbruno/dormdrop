package edu.augustana.csc305.project.service;

import com.mongodb.client.result.UpdateResult;
import edu.augustana.csc305.project.dto.MessageReportActionDtos.SuspensionRequest;
import edu.augustana.csc305.project.dto.ModerationDecisionDtos.Request;
import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.MessageReportActionRepository;
import edu.augustana.csc305.project.repository.MessageReportRepository;
import edu.augustana.csc305.project.repository.UserRepository;
import edu.augustana.csc305.project.security.PermissionPolicy;
import edu.augustana.csc305.project.security.StaffAccess;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.support.TransactionOperations;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import static edu.augustana.csc305.project.model.ModerationTypes.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class IndependentListingHoldsTest {
    private final MongoTemplate mongo = mock(MongoTemplate.class);
    private final MessageReportRepository reports = mock(MessageReportRepository.class);
    private final MessageReportActionRepository actions = mock(MessageReportActionRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final StaffAccess access = mock(StaffAccess.class);
    private final DecisionEvidenceService evidence = mock(DecisionEvidenceService.class);
    private final Authentication auth = mock(Authentication.class);
    private final TransactionOperations transactions = TransactionOperations.withoutTransaction();
    private final User member = new User(new ObjectId(), "Member", "member@example.com", "hash");
    private final User staff = new User(new ObjectId(), "Admin", "admin@example.com", "hash");
    private final ObjectId suspensionId = new ObjectId();
    private final Listing listing = new Listing();
    private boolean statusMissing;
    private ModerationCase reportCase;
    private MessageReportReviewService suspension;
    private ModerationDecisionService decisions;
    private AccountSuspensionExpiry expiry;

    @BeforeEach
    void setUp() {
        listing.setId(new ObjectId());
        listing.setOwnerId(member.getId());
        listing.setVersion(0L);
        Instant now = Instant.now();
        reportCase = new ModerationCase(new ObjectId(), "RPT-1", listing.getId(), null,
                CaseStatus.OPEN, Priority.MEDIUM, null, now, now, 0L);
        MessageReport messageReport = new MessageReport(suspensionId, new ObjectId(), listing.getId(),
                "Listing", new ObjectId(), "Message", now, member.getId(), member.getName(), member.getEmail(),
                new ObjectId(), "Reporter", "reporter@example.com", "Reason", "", List.of(), now, "OPEN");
        when(auth.getName()).thenReturn(staff.getEmail());
        when(users.findByEmail(staff.getEmail())).thenReturn(Optional.of(staff));
        when(users.findById(member.getId())).thenReturn(Optional.of(member));
        when(reports.findById(suspensionId)).thenReturn(Optional.of(messageReport));
        when(access.require(eq(auth), eq(PermissionPolicy.Capability.MODERATE_LISTINGS))).thenReturn(staff);
        ListingSnapshot snapshot = mock(ListingSnapshot.class);
        when(snapshot.id()).thenReturn(new ObjectId());
        when(evidence.retain(any(), any(), any())).thenReturn(snapshot);

        when(mongo.findById(any(), eq(ModerationDecisionReceipt.class))).thenReturn(null);
        when(mongo.findById(any(), eq(ModerationCase.class))).thenAnswer(call -> reportCase);
        when(mongo.findById(any(), eq(Listing.class))).thenAnswer(call -> listing);
        when(mongo.find(any(Query.class), eq(Report.class))).thenReturn(List.of());
        when(mongo.find(any(Query.class), eq(User.class))).thenAnswer(call ->
                matches(call.getArgument(0, Query.class), member) ? List.of(member) : List.of());
        when(mongo.insert(any())).thenAnswer(call -> call.getArgument(0));
        when(mongo.updateFirst(any(Query.class), any(Update.class), eq(MessageReport.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));
        when(mongo.updateFirst(any(Query.class), any(Update.class), eq(User.class)))
                .thenAnswer(call -> updateUser(call.getArgument(0), call.getArgument(1)));
        when(mongo.updateFirst(any(Query.class), any(Update.class), eq(Listing.class)))
                .thenAnswer(call -> updateListing(call.getArgument(0), call.getArgument(1)));
        when(mongo.updateMulti(any(Query.class), any(Update.class), eq(Listing.class)))
                .thenAnswer(call -> updateListing(call.getArgument(0), call.getArgument(1)));
        when(mongo.findAndModify(any(Query.class), any(Update.class), any(FindAndModifyOptions.class),
                eq(ModerationCase.class))).thenAnswer(call -> {
                    Update update = call.getArgument(1);
                    Document set = (Document) update.getUpdateObject().get("$set");
                    reportCase = new ModerationCase(reportCase.id(), reportCase.referenceNumber(),
                            reportCase.listingId(), reportCase.previousCaseId(), (CaseStatus) set.get("status"),
                            reportCase.priority(), reportCase.assignedTo(), reportCase.createdAt(),
                            (Instant) set.get("updatedAt"), reportCase.version() + 1);
                    return reportCase;
                });
        suspension = new MessageReportReviewService(mongo, reports, actions, users, transactions);
        decisions = new ModerationDecisionService(mongo, access, evidence, transactions);
        expiry = new AccountSuspensionExpiry(mongo, transactions);
    }

    @Test
    void reportHideSurvivesSuspensionExpiryUntilReviewIsCleared() {
        suspend();
        assertEquals(Visibility.HIDDEN, listing.getModerationVisibility());
        decide(DecisionAction.HIDE);
        assertEquals(reportCase.id(), listing.getTemporaryHideCaseId());
        expire();
        assertEquals(Visibility.HIDDEN, listing.getModerationVisibility());
        assertNull(listing.getAccountSuspensionId());
        assertEquals(reportCase.id(), listing.getTemporaryHideCaseId());
        decide(DecisionAction.KEEP);
        assertEquals(Visibility.VISIBLE, listing.getModerationVisibility());
        assertNull(listing.getTemporaryHideCaseId());
    }

    @Test
    void suspensionStillHidesListingWhenEarlierReportHoldIsCleared() {
        decide(DecisionAction.HIDE);
        suspend();
        assertEquals(suspensionId, listing.getAccountSuspensionId());
        decide(DecisionAction.KEEP);
        assertEquals(Visibility.HIDDEN, listing.getModerationVisibility());
        assertNull(listing.getTemporaryHideCaseId());
        expire();
        assertEquals(Visibility.VISIBLE, listing.getModerationVisibility());
    }

    @Test
    void suspensionHidesLegacyListingWithoutStoredStatus() {
        statusMissing = true;
        suspend();
        assertEquals(Visibility.HIDDEN, listing.getModerationVisibility());
        assertEquals(suspensionId, listing.getAccountSuspensionId());
        expire();
        assertEquals(Visibility.VISIBLE, listing.getModerationVisibility());
    }

    @Test
    void suspensionHoldsLegacyReportHiddenListingAfterReviewIsCleared() {
        statusMissing = true;
        decide(DecisionAction.HIDE);
        suspend();
        assertEquals(suspensionId, listing.getAccountSuspensionId());
        decide(DecisionAction.KEEP);
        assertEquals(Visibility.HIDDEN, listing.getModerationVisibility());
        expire();
        assertEquals(Visibility.VISIBLE, listing.getModerationVisibility());
    }

    @Test
    void suspensionDoesNotHideSoldListing() {
        listing.setStatus(ListingStatus.SOLD);
        suspend();
        assertEquals(Visibility.VISIBLE, listing.getModerationVisibility());
        assertNull(listing.getAccountSuspensionId());
    }

    @Test
    void removedListingIsNotRestoredOnExpiry() {
        suspend();
        decide(DecisionAction.REMOVE);
        expire();
        assertEquals(Visibility.REMOVED, listing.getModerationVisibility());
        assertNull(listing.getAccountSuspensionId());
    }

    @Test
    void suspensionExpiryDoesNotReleaseAnUnrelatedHiddenListing() {
        listing.setModerationVisibility(Visibility.HIDDEN);
        suspend();
        assertNull(listing.getAccountSuspensionId());
        expire();
        assertEquals(Visibility.HIDDEN, listing.getModerationVisibility());
    }

    @Test
    void expiryDoesNotClearAnExtendedSuspension() {
        suspend();
        User stale = new User(member.getId(), member.getName(), member.getEmail(), "hash");
        stale.setSuspendedUntil(Instant.now().minusSeconds(1));
        stale.setSuspensionReportId(suspensionId);
        when(mongo.find(any(Query.class), eq(User.class))).thenReturn(List.of(stale));

        expiry.restoreExpiredSuspensions();

        assertEquals(suspensionId, member.getSuspensionReportId());
        assertEquals(suspensionId, listing.getAccountSuspensionId());
        assertEquals(Visibility.HIDDEN, listing.getModerationVisibility());
    }

    @Test
    void expiryDoesNotClearAReplacementSuspension() {
        suspend();
        User stale = new User(member.getId(), member.getName(), member.getEmail(), "hash");
        stale.setSuspendedUntil(Instant.now().minusSeconds(1));
        stale.setSuspensionReportId(suspensionId);
        ObjectId replacementId = new ObjectId();
        member.setSuspendedUntil(Instant.now().minusSeconds(1));
        member.setSuspensionReportId(replacementId);
        listing.setAccountSuspensionId(replacementId);
        when(mongo.find(any(Query.class), eq(User.class))).thenReturn(List.of(stale));

        expiry.restoreExpiredSuspensions();

        assertEquals(replacementId, member.getSuspensionReportId());
        assertEquals(replacementId, listing.getAccountSuspensionId());
        assertEquals(Visibility.HIDDEN, listing.getModerationVisibility());
    }

    private void suspend() {
        suspension.suspend(suspensionId.toHexString(), new SuspensionRequest(1, "Reason", "Notice"), auth);
    }

    private void expire() {
        member.setSuspendedUntil(Instant.now().minusSeconds(1));
        expiry.restoreExpiredSuspensions();
    }

    private void decide(DecisionAction action) {
        decisions.decide(ModerationDecisionService.Target.CASE, reportCase.id().toHexString(),
                new Request(action, reportCase.version(), "Reason", "Rationale", "Notice"),
                new ObjectId().toHexString(), auth);
    }

    private UpdateResult updateUser(Query query, Update update) {
        if (!matches(query, member)) return UpdateResult.acknowledged(0, 0L, null);
        Document set = update.getUpdateObject().get("$set", Document.class);
        if (set != null) {
            if (set.containsKey("suspendedUntil")) member.setSuspendedUntil((Instant) set.get("suspendedUntil"));
            if (set.containsKey("suspensionReportId")) member.setSuspensionReportId((ObjectId) set.get("suspensionReportId"));
        }
        Document unset = update.getUpdateObject().get("$unset", Document.class);
        if (unset != null) {
            if (unset.containsKey("suspendedUntil")) member.setSuspendedUntil(null);
            if (unset.containsKey("suspensionReportId")) member.setSuspensionReportId(null);
        }
        return UpdateResult.acknowledged(1, 1L, null);
    }

    private UpdateResult updateListing(Query query, Update update) {
        if (!matches(query, listing)) return UpdateResult.acknowledged(0, 0L, null);
        Document set = update.getUpdateObject().get("$set", Document.class);
        if (set != null) {
            if (set.containsKey("moderationVisibility")) listing.setModerationVisibility((Visibility) set.get("moderationVisibility"));
            if (set.containsKey("temporaryHideCaseId")) listing.setTemporaryHideCaseId((ObjectId) set.get("temporaryHideCaseId"));
            if (set.containsKey("accountSuspensionId")) listing.setAccountSuspensionId((ObjectId) set.get("accountSuspensionId"));
        }
        Document unset = update.getUpdateObject().get("$unset", Document.class);
        if (unset != null) {
            if (unset.containsKey("temporaryHideCaseId")) listing.setTemporaryHideCaseId(null);
            if (unset.containsKey("accountSuspensionId")) listing.setAccountSuspensionId(null);
        }
        Document inc = update.getUpdateObject().get("$inc", Document.class);
        if (inc != null && inc.containsKey("version")) listing.setVersion(listing.getVersion() + ((Number) inc.get("version")).longValue());
        return UpdateResult.acknowledged(1, 1L, null);
    }

    private boolean matches(Query query, Object entity) {
        return matches(query.getQueryObject(), entity);
    }

    private boolean matches(Document query, Object entity) {
        for (var entry : query.entrySet()) {
            if (entry.getKey().equals("$or")) {
                if (((List<?>) entry.getValue()).stream().noneMatch(part -> matches((Document) part, entity))) return false;
                continue;
            }
            Object value = switch (entry.getKey()) {
                case "_id" -> entity instanceof User user ? user.getId() : listing.getId();
                case "ownerId" -> listing.getOwnerId();
                case "status" -> listing.getStatus();
                case "version" -> listing.getVersion();
                case "moderationVisibility" -> listing.getModerationVisibility();
                case "temporaryHideCaseId" -> listing.getTemporaryHideCaseId();
                case "accountSuspensionId" -> listing.getAccountSuspensionId();
                case "suspensionReportId" -> member.getSuspensionReportId();
                case "suspendedUntil" -> member.getSuspendedUntil();
                default -> throw new AssertionError("Unexpected query field: " + entry.getKey());
            };
            Object expected = entry.getValue();
            if (expected instanceof Document operator) {
                if (operator.containsKey("$in") && (entry.getKey().equals("status") && statusMissing
                        || ((List<?>) operator.get("$in")).stream().noneMatch(item -> equalValue(value, item)))) return false;
                if (operator.containsKey("$ne") && equalValue(value, operator.get("$ne"))) return false;
                if (operator.containsKey("$lte") && (value == null || ((Instant) value).isAfter((Instant) operator.get("$lte")))) return false;
                if (operator.containsKey("$exists") && !Objects.equals(operator.get("$exists"), !statusMissing)) return false;
            } else if (!equalValue(value, expected)) {
                return false;
            }
        }
        return true;
    }

    private boolean equalValue(Object actual, Object expected) {
        return Objects.equals(actual, expected)
                || (actual instanceof Enum<?> enumValue && Objects.equals(enumValue.name(), expected));
    }
}
