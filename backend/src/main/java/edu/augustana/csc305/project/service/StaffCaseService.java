package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.dto.*;
import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.UserRepository;
import edu.augustana.csc305.project.security.StaffAccess;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DataAccessException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.TransactionException;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;
import java.util.function.Supplier;

import static edu.augustana.csc305.project.dto.StaffCaseDtos.*;
import static edu.augustana.csc305.project.model.ModerationTypes.*;
import static edu.augustana.csc305.project.security.StaffAccess.Capability.*;

@Service
public class StaffCaseService {
    private final MongoTemplate mongo;
    private final UserRepository users;
    private final StaffAccess access;
    private final TransactionOperations transactions;
    public StaffCaseService(MongoTemplate mongo, UserRepository users, StaffAccess access,
                            @Qualifier("reportTransactions") TransactionOperations transactions) {
        this.mongo = mongo; this.users = users; this.access = access; this.transactions = transactions;
    }

    public QueuePage queue(Authentication auth, CaseStatus status, Priority priority, int page, int size) {
        access.require(auth, REVIEW_CASES);
        if (page < 0 || size < 1 || size > 100) throw badRequest("Page must be nonnegative; size must be 1 to 100.");
        return read(() -> {
            Criteria criteria = new Criteria();
            if (status != null) criteria.and("status").is(status);
            if (priority != null) criteria.and("priority").is(priority);
            long total = mongo.count(Query.query(criteria), ModerationCase.class);
            List<CaseSummary> items = mongo.find(Query.query(criteria)
                            .with(Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("_id")))
                            .skip((long)page * size).limit(size), ModerationCase.class)
                    .stream().map(this::summary).toList();
            return new QueuePage(items, total, page, size, total == 0 ? 0 : (total - 1) / size + 1);
        });
    }

    public CaseDetail detail(Authentication auth, String id) {
        access.require(auth, REVIEW_CASES);
        ObjectId caseId = id(id);
        return read(() -> {
            ModerationCase reportCase = requireCase(caseId);
            List<Report> reports = mongo.find(caseQuery(caseId), Report.class);
            Map<ObjectId, List<ModerationDtos.StaffReport>> grouped = new LinkedHashMap<>();
            for (Report report : reports) grouped.computeIfAbsent(report.snapshotId(), ignored -> new ArrayList<>())
                    .add(new ModerationDtos.StaffReport(hex(report.id()), hex(report.reporterId()), hex(report.snapshotId()),
                            report.category(), report.description(), report.createdAt()));
            List<ReportGroup> groups = grouped.entrySet().stream()
                    .map(entry -> new ReportGroup(hex(entry.getKey()), List.copyOf(entry.getValue()))).toList();
            List<ModerationDecision> caseDecisions = mongo.find(caseQuery(caseId), ModerationDecision.class);
            Set<ObjectId> snapshotIds = new LinkedHashSet<>(grouped.keySet());
            caseDecisions.stream().map(ModerationDecision::snapshotId).filter(Objects::nonNull).forEach(snapshotIds::add);
            // Include report evidence and direct staff decision evidence, but never orphan/unrelated snapshots.
            Query snapshotQuery = Query.query(Criteria.where("caseId").is(caseId)
                    .and("listingId").is(reportCase.listingId()).and("_id").in(new ArrayList<>(snapshotIds)))
                    .with(Sort.by(Sort.Order.asc("capturedAt"), Sort.Order.asc("_id")));
            snapshotQuery.fields().exclude("retainedImages");
            List<ListingSnapshot> retained = mongo.find(snapshotQuery, ListingSnapshot.class);
            List<SnapshotMetadata> snapshots = retained.stream().map(snapshot -> new SnapshotMetadata(hex(snapshot.id()),
                    hex(snapshot.listingId()), hex(snapshot.sellerId()), snapshot.sourceListingVersion(), snapshot.title(),
                    snapshot.description(), snapshot.price(), snapshot.category(), snapshot.lifecycleStatus(),
                    snapshot.capturedAt(), snapshot.privateEvidenceKeys())).toList();
            SellerContext seller = retained.isEmpty() ? null : new SellerContext(hex(retained.get(0).sellerId()),
                    retained.get(0).sellerDisplayName());
            var decisions = caseDecisions.stream().map(decision ->
                    new ModerationDtos.StaffDecision(hex(decision.id()), hex(decision.staffId()), decision.action(),
                            decision.internalRationale(), hex(decision.correctsDecisionId()), decision.createdAt(),
                            decision.policyReason(), hex(decision.snapshotId()), decision.reviewedReportIds().stream().map(StaffCaseService::hex).toList())).toList();
            var activity = mongo.find(caseQuery(caseId), ActivityEvent.class).stream().map(event ->
                    new StaffActivity(hex(event.id()), hex(event.actorId()), event.type(), hex(event.relatedRecordId()),
                            hex(event.correctsEventId()), event.internalNote(), event.createdAt())).toList();
            return new CaseDetail(summary(reportCase), groups, snapshots, seller, decisions, activity);
        });
    }

    /** Missing assigneeId means claim for the current staff member; explicit ID assigns eligible staff. */
    public CaseSummary assign(Authentication auth, String id, Assignment request) {
        User actor = access.require(auth, ASSIGN_CASES);
        if (request == null || request.expectedVersion() == null || request.expectedVersion() < 0) {
            throw badRequest("A nonnegative expectedVersion is required.");
        }
        ObjectId caseId = id(id);
        boolean claim = request.assigneeId() == null;
        ObjectId target = claim ? actor.getId() : id(request.assigneeId());
        User assignee = users.findById(target).orElseThrow(() -> badRequest("Assignee is not eligible staff."));
        if (!StaffAccess.permits(assignee.getRole(), REVIEW_CASES)) throw badRequest("Assignee is not eligible staff.");
        try {
            return Objects.requireNonNull(transactions.execute(tx -> {
                requireCase(caseId);
                Criteria criteria = Criteria.where("_id").is(caseId).and("version").is(request.expectedVersion())
                        .and("status").in(CaseStatus.OPEN, CaseStatus.IN_REVIEW);
                if (claim) criteria.orOperator(Criteria.where("assignedTo").is(null), Criteria.where("assignedTo").is(actor.getId()));
                Instant now = Instant.now();
                ModerationCase changed = mongo.findAndModify(Query.query(criteria),
                        new Update().set("assignedTo", target).set("status", CaseStatus.IN_REVIEW)
                                .set("updatedAt", now).inc("version", 1L),
                        FindAndModifyOptions.options().returnNew(true), ModerationCase.class);
                if (changed == null) throw conflict();
                mongo.insert(new ActivityEvent(new ObjectId(), caseId, actor.getId(), EventType.ASSIGNMENT_CHANGED,
                        target, null, null, request.expectedVersion(), now));
                return summary(changed);
            }));
        } catch (DataAccessException | TransactionException failure) {
            for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
                if (cause instanceof com.mongodb.MongoException mongoFailure
                        && (mongoFailure.getCode() == 112 || mongoFailure.hasErrorLabel("TransientTransactionError"))) {
                    throw conflict();
                }
            }
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Assignment could not be confirmed. Refresh the case.", failure);
        }
    }

    private <T> T read(Supplier<T> query) {
        try { return Objects.requireNonNull(transactions.execute(tx -> query.get())); }
        catch (DataAccessException | TransactionException failure) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Case data is temporarily unavailable.", failure);
        }
    }
    private CaseSummary summary(ModerationCase reportCase) {
        return new CaseSummary(hex(reportCase.id()), reportCase.referenceNumber(), hex(reportCase.listingId()),
                hex(reportCase.previousCaseId()), reportCase.status(), reportCase.priority(), hex(reportCase.assignedTo()),
                reportCase.version(), reportCase.createdAt(), reportCase.updatedAt(),
                mongo.count(Query.query(Criteria.where("caseId").is(reportCase.id())), Report.class));
    }
    private Query caseQuery(ObjectId caseId) {
        return Query.query(Criteria.where("caseId").is(caseId))
                .with(Sort.by(Sort.Order.asc("createdAt"), Sort.Order.asc("_id")));
    }
    private ModerationCase requireCase(ObjectId caseId) {
        ModerationCase reportCase = mongo.findById(caseId, ModerationCase.class);
        if (reportCase == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Case not found.");
        return reportCase;
    }
    private ObjectId id(String value) {
        if (value == null || !ObjectId.isValid(value)) throw badRequest("Invalid ID.");
        return new ObjectId(value);
    }
    private static String hex(ObjectId id) { return id == null ? null : id.toHexString(); }
    private ResponseStatusException badRequest(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    private ResponseStatusException conflict() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "Case changed, is resolved, or is already claimed. Refresh before retrying.");
    }
}
