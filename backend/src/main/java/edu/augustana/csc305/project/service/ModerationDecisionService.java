package edu.augustana.csc305.project.service;

import com.mongodb.MongoException;
import edu.augustana.csc305.project.dto.ModerationDecisionDtos.*;
import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.security.StaffAccess;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.*;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.*;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.TransactionException;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.web.server.ResponseStatusException;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;

import static edu.augustana.csc305.project.model.ModerationTypes.*;

@Service
public class ModerationDecisionService {
    public enum Target { CASE, LISTING }
    public record Outcome(Result result, boolean created) {}
    private final MongoTemplate mongo;
    private final StaffAccess access;
    private final DecisionEvidenceService evidence;
    private final TransactionOperations transactions;
    public ModerationDecisionService(MongoTemplate mongo, StaffAccess access, DecisionEvidenceService evidence,
                                      @Qualifier("reportTransactions") TransactionOperations transactions) {
        this.mongo = mongo; this.access = access; this.evidence = evidence; this.transactions = transactions;
    }

    public Outcome decide(Target target, String id, Request request, String key, Authentication auth) {
        User staff = access.require(auth, edu.augustana.csc305.project.security.PermissionPolicy.Capability.MODERATE_LISTINGS);
        if (target == null || id == null || !ObjectId.isValid(id)) throw badRequest("Invalid decision target.");
        if (key == null || !key.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}")) throw badRequest("A valid Idempotency-Key is required.");
        Request normalized = validate(request);
        ObjectId targetId = new ObjectId(id);
        String requestId = staff.getId().toHexString()+":"+key;
        String fingerprint = fingerprint(target, targetId, normalized);
        ObjectId decisionId = new ObjectId();
        for (int attempt = 0; attempt < 6; attempt++) {
            try {
                return Objects.requireNonNull(transactions.execute(tx -> execute(target, targetId, normalized,
                        requestId, fingerprint, decisionId, staff)));
            } catch (DataAccessException | TransactionException failure) {
                if (!retryable(failure)) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "Decision could not be confirmed. Retry with the same Idempotency-Key.", failure);
                java.util.concurrent.locks.LockSupport.parkNanos(30_000_000L);
            }
        }
        throw conflict("The listing or case changed. Refresh before deciding again.");
    }

    private Outcome execute(Target target, ObjectId targetId, Request request, String key, String fingerprint,
                            ObjectId decisionId, User staff) {
        ModerationDecisionReceipt receipt = mongo.findById(key, ModerationDecisionReceipt.class);
        if (receipt != null) {
            if (!fingerprint.equals(receipt.fingerprint())) throw conflict("Idempotency-Key was used for a different decision.");
            return new Outcome(receipt.result(), false);
        }
        ModerationCase reportCase;
        Listing listing;
        if (target == Target.CASE) {
            reportCase = mongo.findById(targetId, ModerationCase.class);
            if (reportCase == null) throw notFound("Case not found.");
            if (!request.expectedVersion().equals(reportCase.version())) throw conflict("Case changed. Refresh before deciding again.");
            listing = mongo.findById(reportCase.listingId(), Listing.class);
        } else {
            listing = mongo.findById(targetId, Listing.class);
            if (listing == null) throw notFound("Listing not found.");
            if (!request.expectedVersion().equals(listing.getVersion())) throw conflict("Listing changed. Refresh before deciding again.");
            reportCase = mongo.findOne(Query.query(Criteria.where("listingId").is(targetId)
                    .and("status").in(CaseStatus.OPEN, CaseStatus.IN_REVIEW)), ModerationCase.class);
            if (reportCase == null) {
                ModerationCase previous = mongo.findOne(Query.query(Criteria.where("listingId").is(targetId)
                        .and("status").is(CaseStatus.RESOLVED)).with(Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("_id"))), ModerationCase.class);
                reportCase = mongo.insert(ModerationCase.open(targetId, previous == null ? null : previous.id()));
            }
        }
        if (reportCase.status() == CaseStatus.RESOLVED) throw conflict("This case is already resolved.");
        if (request.action() == DecisionAction.HIDE && (listing == null || listing.getModerationVisibility() == Visibility.REMOVED))
            throw conflict("A deleted or removed listing cannot be temporarily hidden.");

        ListingSnapshot snapshot = evidence.retain(decisionId, reportCase, listing);
        ObjectId sellerId = listing == null ? snapshot.sellerId() : listing.getOwnerId();
        if (sellerId == null) throw conflict("Seller context is missing from the retained evidence.");
        List<Report> reports = mongo.find(Query.query(Criteria.where("caseId").is(reportCase.id())), Report.class);
        Instant now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MILLIS);
        Long listingVersion = null;
        Visibility visibility = null;
        if (listing != null) {
            Update change = new Update().inc("version", 1L);
            visibility = listing.getModerationVisibility();
            if (request.action() == DecisionAction.REMOVE) {
                visibility = Visibility.REMOVED;
                change.set("moderationVisibility", visibility).unset("temporaryHideCaseId");
            } else if (request.action() == DecisionAction.HIDE && visibility == Visibility.VISIBLE) {
                visibility = Visibility.HIDDEN;
                change.set("moderationVisibility", visibility).set("temporaryHideCaseId", reportCase.id());
            } else if (request.action() == DecisionAction.KEEP && visibility == Visibility.HIDDEN
                    && reportCase.id().equals(listing.getTemporaryHideCaseId())) {
                visibility = Visibility.VISIBLE;
                change.set("moderationVisibility", visibility).unset("temporaryHideCaseId");
            }
            if (mongo.updateFirst(Query.query(Criteria.where("_id").is(listing.getId())
                    .and("version").is(listing.getVersion())), change, Listing.class).getModifiedCount() != 1)
                throw conflict("Listing changed. Refresh before deciding again.");
            listingVersion = listing.getVersion()+1;
        }
        CaseStatus outcome = request.action() == DecisionAction.HIDE ? CaseStatus.IN_REVIEW : CaseStatus.RESOLVED;
        ModerationCase changed = mongo.findAndModify(Query.query(Criteria.where("_id").is(reportCase.id())
                        .and("version").is(reportCase.version()).and("status").in(CaseStatus.OPEN,CaseStatus.IN_REVIEW)),
                new Update().set("status",outcome).set("updatedAt",now).inc("version",1L),
                FindAndModifyOptions.options().returnNew(true), ModerationCase.class);
        if (changed == null) throw conflict("Case changed. Refresh before deciding again.");
        String reporterMessage = request.action() == DecisionAction.HIDE ? "Your report is still under review." : "Your report has been reviewed.";
        mongo.insert(new ModerationDecision(decisionId, reportCase.id(), staff.getId(), request.action(),
                request.internalRationale(), request.sellerMessage(), reporterMessage, null, reportCase.version(), now,
                request.policyReason(), listing == null ? null : listing.getVersion(), snapshot.id(),
                reports.stream().map(Report::id).toList()));
        mongo.insert(new ActivityEvent(new ObjectId(), reportCase.id(), staff.getId(), EventType.DECISION_RECORDED,
                decisionId, null, request.internalRationale(), reportCase.version(), now));
        mongo.insert(new ModerationNotificationEvent(decisionId, decisionId, reportCase.id(), reportCase.listingId(), sellerId,
                request.action() == DecisionAction.HIDE ? List.of() : reports.stream().map(Report::reporterId)
                        .filter(Objects::nonNull).distinct().toList(), request.action(), request.sellerMessage(),
                reporterMessage, "PENDING", now));
        Result result = new Result(decisionId.toHexString(), reportCase.id().toHexString(), reportCase.referenceNumber(),
                reportCase.listingId().toHexString(), request.action(), visibility, listing == null,
                changed.version(), listingVersion, now);
        mongo.insert(new ModerationDecisionReceipt(key, fingerprint, result, now));
        return new Outcome(result, true);
    }

    private Request validate(Request request) {
        if (request == null || request.action() == null || request.expectedVersion() == null || request.expectedVersion() < 0)
            throw badRequest("An action and nonnegative expectedVersion are required.");
        String reason = text(request.policyReason(),500,true,"Policy reason");
        String rationale = text(request.internalRationale(),4000,true,"Internal rationale");
        String seller = text(request.sellerMessage(),2000,request.action()==DecisionAction.REMOVE,"Seller message");
        if (seller == null) seller = request.action() == DecisionAction.HIDE
                ? "Your listing has been temporarily hidden while it is reviewed."
                : "Review completed. Any other existing listing restrictions still apply.";
        return new Request(request.action(),request.expectedVersion(),reason,rationale,seller);
    }
    private String text(String value,int max,boolean required,String name) {
        if (value != null && value.length() > max) throw badRequest(name+" is too long.");
        if (value == null || value.isBlank()) {
            if (required) throw badRequest(name+" is required.");
            return null;
        }
        return value.strip();
    }
    private String fingerprint(Target target,ObjectId id,Request request) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            for (String part : List.of(target.name(),id.toHexString(),request.expectedVersion().toString(),
                    request.action().name(),request.policyReason(),request.internalRationale(),request.sellerMessage())) {
                byte[] bytes = part.getBytes(StandardCharsets.UTF_8);
                digest.update(ByteBuffer.allocate(4).putInt(bytes.length).array()); digest.update(bytes);
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
    private boolean retryable(Throwable failure) {
        if (failure instanceof DuplicateKeyException) return true;
        for (Throwable cause=failure;cause!=null;cause=cause.getCause())
            if (cause instanceof MongoException mongoFailure && (mongoFailure.getCode()==112
                    || mongoFailure.hasErrorLabel("TransientTransactionError") || mongoFailure.hasErrorLabel("UnknownTransactionCommitResult"))) return true;
        return false;
    }
    private ResponseStatusException badRequest(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST,message); }
    private ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT,message); }
    private ResponseStatusException notFound(String message) { return new ResponseStatusException(HttpStatus.NOT_FOUND,message); }
}
