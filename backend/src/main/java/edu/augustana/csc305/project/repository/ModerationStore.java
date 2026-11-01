package edu.augustana.csc305.project.repository;

import edu.augustana.csc305.project.model.*;
import org.bson.types.ObjectId;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

import static edu.augustana.csc305.project.model.ModerationTypes.*;

@Repository
public class ModerationStore {
    private final MongoTemplate mongo;

    public ModerationStore(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    public Optional<ModerationCase> findCase(ObjectId caseId) {
        return Optional.ofNullable(mongo.findById(caseId, ModerationCase.class));
    }

    public Optional<ModerationCase> findActiveCase(ObjectId listingId) {
        Query query = Query.query(Criteria.where("listingId").is(listingId).and("status").in(CaseStatus.OPEN, CaseStatus.IN_REVIEW));

        return Optional.ofNullable(mongo.findOne(query, ModerationCase.class));
    }

    public ModerationCase createCase(ObjectId listingId) {
        Query previousQuery = Query.query(Criteria.where("listingId").is(listingId).and("status").is(CaseStatus.RESOLVED)).with(Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("_id"))).limit(1);

        ModerationCase previous = mongo.findOne(previousQuery, ModerationCase.class);

        return mongo.insert(ModerationCase.open(listingId, previous == null ? null : previous.id()));
    }

    /*
     * The unique index arbitrates concurrent creation.
     * Submission #69 must handle its transactional retries separately.
     */
    public ModerationCase findOrCreateActiveCase(ObjectId listingId) {
        for (int attempt = 0; attempt < 3; attempt++) {
            Optional<ModerationCase> existing = findActiveCase(listingId);

            if (existing.isPresent()) {
                return existing.get();
            }

            try {
                return createCase(listingId);
            } catch (DuplicateKeyException conflict) {
                // Another request may have created the active case.
            }
        }

        return findActiveCase(listingId).orElseThrow(() -> new IllegalStateException("Case changed repeatedly. Retry the operation."));
    }

    // Evidence and history expose insert operations, not overwrite methods.

    public Report insertReport(Report report) {
        return mongo.insert(report);
    }

    public ListingSnapshot insertSnapshot(ListingSnapshot snapshot) {
        return mongo.insert(snapshot);
    }

    public ModerationDecision appendDecision(ModerationDecision decision) {
        if (decision.correctsDecisionId() != null) {
            ModerationDecision original = mongo.findById(decision.correctsDecisionId(), ModerationDecision.class);

            if (original == null || !original.caseId().equals(decision.caseId())) {
                throw new IllegalArgumentException("Correction must reference a decision in this case.");
            }
        }

        return mongo.insert(decision);
    }

    public ActivityEvent appendActivity(ActivityEvent event) {
        if (event.correctsEventId() != null) {
            ActivityEvent original = mongo.findById(event.correctsEventId(), ActivityEvent.class);

            if (original == null || !original.caseId().equals(event.caseId())) {
                throw new IllegalArgumentException("Correction must reference an event in this case.");
            }
        }

        return mongo.insert(event);
    }

    public List<Report> reportsForCase(ObjectId caseId) {
        return mongo.find(Query.query(Criteria.where("caseId").is(caseId)).with(Sort.by(Sort.Order.asc("createdAt"), Sort.Order.asc("_id"))), Report.class);
    }

    public long reportCount(ObjectId caseId) {
        return mongo.count(Query.query(Criteria.where("caseId").is(caseId)), Report.class);
    }
}
