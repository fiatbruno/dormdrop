package edu.augustana.csc305.project.service;

import com.mongodb.MongoException;
import edu.augustana.csc305.project.dto.ModerationDtos;
import edu.augustana.csc305.project.dto.SubmitReportRequest;
import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.UserRepository;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

import static edu.augustana.csc305.project.model.ModerationTypes.*;

@Service
public class ReportSubmissionService {
    private final MongoTemplate mongo;
    private final UserRepository users;
    private final ListingEvidenceService evidence;
    private final TransactionOperations transactions;
    private final int limit;
    private final long windowSeconds;

    public ReportSubmissionService(MongoTemplate mongo, UserRepository users, ListingEvidenceService evidence,
            @Qualifier("reportTransactions") TransactionOperations transactions,
            @Value("${app.reports.limit:5}") int limit,
            @Value("${app.reports.window-seconds:3600}") long windowSeconds) {
        if (limit < 1 || windowSeconds < 1 || windowSeconds > 31536000) {
            throw new IllegalArgumentException("Report limits must be positive; window must be at most one year.");
        }
        this.mongo = mongo;
        this.users = users;
        this.evidence = evidence;
        this.transactions = transactions;
        this.limit = limit;
        this.windowSeconds = windowSeconds;
    }

    public record Submission(ModerationDtos.ReporterStatus status, boolean created) {}

    public static final class RateLimitExceeded extends ResponseStatusException {
        private final long retryAfter;
        public RateLimitExceeded(long retryAfter) {
            super(HttpStatus.TOO_MANY_REQUESTS, "Report limit exceeded. Please try again later.");
            this.retryAfter = retryAfter;
        }
        public long retryAfter() { return retryAfter; }
    }

    public Submission submit(String listingId, SubmitReportRequest body, String key, Authentication auth) {
        User reporter = verified(auth);
        if (listingId == null || !ObjectId.isValid(listingId)) throw badRequest("Invalid listing ID.");
        if (key == null || !key.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}")) {
            throw badRequest("Idempotency-Key must contain 1 to 128 letters, digits, dots, colons, underscores or hyphens.");
        }
        if (body == null || body.description() == null || body.description().isBlank()
                || body.description().length() > 2000 || body.category() == null || body.category().length() > 64) {
            throw badRequest("A valid category and description of 1 to 2000 characters are required.");
        }
        ReportCategory category;
        try { category = ReportCategory.valueOf(body.category()); }
        catch (IllegalArgumentException invalid) { throw badRequest("Invalid report category."); }
        String description = body.description().strip();
        ObjectId target = new ObjectId(listingId);
        String requestId = reporter.getId().toHexString() + ":" + key;
        // Stable for all transaction attempts, including an ambiguous commit result.
        ObjectId reportId = new ObjectId();
        for (int attempt = 0; attempt < 12; attempt++) {
            try {
                return Objects.requireNonNull(transactions.execute(status ->
                        submitTransaction(target, category, description, requestId, reportId, reporter)));
            } catch (DataAccessException | org.springframework.transaction.TransactionException conflict) {
                if (!retryable(conflict)) {
                    throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                            "Report could not be saved. Retry with the same Idempotency-Key.", conflict);
                }
                // A fresh transaction re-reads the winning case/request and rate-limit window.
                java.util.concurrent.locks.LockSupport.parkNanos(
                        java.util.concurrent.ThreadLocalRandom.current().nextLong(5, 51) * 1_000_000L);
            }
        }
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Reporting is busy. Retry with the same Idempotency-Key.");
    }

    private Submission submitTransaction(ObjectId listingId, ReportCategory category, String description,
                                          String requestId, ObjectId reportId, User reporter) {
        ReportRequest previousRequest = mongo.findById(requestId, ReportRequest.class);
        if (previousRequest != null) {
            if (!listingId.equals(previousRequest.listingId()) || category != previousRequest.category()
                    || !description.equals(previousRequest.description())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Idempotency-Key was used for a different request.");
            }
            Report report = mongo.findById(previousRequest.reportId(), Report.class);
            if (report == null || !reporter.getId().equals(report.reporterId())) {
                throw new IllegalStateException("Invalid report idempotency record.");
            }
            return result(report, false);
        }
        Listing listing = mongo.findById(listingId, Listing.class);
        if (listing == null || listing.getStatus() != ListingStatus.AVAILABLE
                || listing.getModerationVisibility() != Visibility.VISIBLE) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing is not available for reporting.");
        }
        Instant now = Instant.now();
        ModerationCase active = mongo.findOne(Query.query(Criteria.where("listingId").is(listingId)
                .and("status").in(CaseStatus.OPEN, CaseStatus.IN_REVIEW)), ModerationCase.class);
        if (active != null) {
            Report previousReport = mongo.findOne(Query.query(Criteria.where("caseId").is(active.id())
                    .and("reporterId").is(reporter.getId())), Report.class);
            if (previousReport != null) {
                mongo.insert(new ReportRequest(requestId, listingId, category, description, previousReport.id(), now));
                return result(previousReport, false);
            }
        }
        consumeRateLimit(reporter.getId(), now);
        if (active == null) {
            ModerationCase prior = mongo.findOne(Query.query(Criteria.where("listingId").is(listingId)
                    .and("status").is(CaseStatus.RESOLVED))
                    .with(Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("_id"))).limit(1), ModerationCase.class);
            active = mongo.insert(ModerationCase.open(listingId, prior == null ? null : prior.id()));
        }
        Report report = new Report(reportId, active.id(), listingId, reporter.getId(), reportId,
                category, description, requestId, now);
        evidence.retainAndInsertReport(report, listing.getVersion());

        // Fence concurrent resolution and seller edits/deletion. Lifecycle/visibility are never changed.
        var caseWrite = mongo.updateFirst(Query.query(Criteria.where("_id").is(active.id())
                .and("version").is(active.version()).and("status").in(CaseStatus.OPEN, CaseStatus.IN_REVIEW)),
                new Update().inc("version", 1L).set("updatedAt", now), ModerationCase.class);
        var listingWrite = mongo.updateFirst(Query.query(Criteria.where("_id").is(listingId)
                .and("version").is(listing.getVersion()).and("status").is(ListingStatus.AVAILABLE)
                .and("moderationVisibility").is(Visibility.VISIBLE)), new Update().inc("version", 1L), Listing.class);
        if (caseWrite.getModifiedCount() != 1 || listingWrite.getModifiedCount() != 1) {
            throw new org.springframework.dao.OptimisticLockingFailureException("Listing or case changed.");
        }
        mongo.insert(new ReportRequest(requestId, listingId, category, description, report.id(), now));
        return result(report, true);
    }

    private void consumeRateLimit(ObjectId reporterId, Instant now) {
        ReportRateWindow window = mongo.findById(reporterId, ReportRateWindow.class);
        if (window == null) {
            mongo.insert(new ReportRateWindow(reporterId, now, 1));
        } else if (!now.isBefore(window.startedAt().plusSeconds(windowSeconds))) {
            mongo.save(new ReportRateWindow(reporterId, now, 1));
        } else if (window.count() >= limit) {
            long seconds = Math.max(1, window.startedAt().plusSeconds(windowSeconds).getEpochSecond() - now.getEpochSecond() + 1);
            throw new RateLimitExceeded(seconds);
        } else {
            mongo.save(new ReportRateWindow(reporterId, window.startedAt(), window.count() + 1));
        }
    }

    public List<ModerationDtos.ReporterStatus> ownReports(Authentication auth, int page, int size) {
        User reporter = verified(auth);
        if (page < 0 || size < 1 || size > 100) throw badRequest("Page must be nonnegative and size between 1 and 100.");
        return mongo.find(Query.query(Criteria.where("reporterId").is(reporter.getId()))
                        .with(Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("_id")))
                        .skip((long) page * size).limit(size), Report.class)
                .stream().map(report -> result(report, false).status()).toList();
    }

    private Submission result(Report report, boolean created) {
        ModerationCase reportCase = mongo.findById(report.caseId(), ModerationCase.class);
        if (reportCase == null) throw new IllegalStateException("Report case is missing.");
        return new Submission(ModerationDtos.reporterStatus(report, reportCase), created);
    }

    private User verified(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required.");
        }
        User user = users.findByEmail(auth.getName()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found."));
        if (!user.isEmailVerified()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Verified email required.");
        return user;
    }

    private boolean retryable(Throwable failure) {
        if (failure instanceof DuplicateKeyException
                || failure instanceof org.springframework.dao.OptimisticLockingFailureException) return true;
        for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
            if (cause instanceof MongoException mongoFailure && (mongoFailure.hasErrorLabel("TransientTransactionError")
                    || mongoFailure.hasErrorLabel("UnknownTransactionCommitResult") || mongoFailure.getCode() == 112)) return true;
        }
        return false;
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
