package edu.augustana.csc305.project.service;

import org.bson.Document;
import org.springframework.beans.factory.annotation.*;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.*;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.stereotype.Component;
import java.time.*;
import java.util.UUID;

/** Shared lease/retry policy for outbox materialization and live delivery; supports multiple backend instances. */
@Component
public class NotificationLeaseQueue {
    private final MongoTemplate mongo;
    private final Clock clock;
    private final long retrySeconds, leaseSeconds;
    public record Claim(Document document, String token, int attempt) {}
    public NotificationLeaseQueue(MongoTemplate mongo, @Qualifier("notificationClock") Clock clock,
            @Value("${app.notifications.retry-seconds:5}") long retrySeconds,
            @Value("${app.notifications.lease-seconds:30}") long leaseSeconds) {
        if (retrySeconds < 1 || retrySeconds > 3600 || leaseSeconds < 1 || leaseSeconds > 3600)
            throw new IllegalArgumentException("Notification retry and lease intervals must be 1 to 3600 seconds.");
        this.mongo=mongo; this.clock=clock; this.retrySeconds=retrySeconds; this.leaseSeconds=leaseSeconds;
    }
    public Claim claim(String collection) {
        Instant now=clock.instant(); String token=UUID.randomUUID().toString();
        Criteria due = new Criteria().orOperator(Criteria.where("nextAttemptAt").is(null),Criteria.where("nextAttemptAt").lte(now));
        Criteria ready = new Criteria().andOperator(Criteria.where("status").in("PENDING","RETRY"),due);
        Criteria expired = Criteria.where("status").is("PROCESSING").and("leaseUntil").lte(now);
        Document claimed = mongo.findAndModify(Query.query(new Criteria().orOperator(ready,expired))
                        .with(Sort.by(Sort.Order.asc("createdAt"),Sort.Order.asc("_id"))),
                new Update().set("status","PROCESSING").set("leaseToken",token)
                        .set("leaseUntil",now.plusSeconds(leaseSeconds)).inc("attempts",1),
                FindAndModifyOptions.options().returnNew(true),Document.class,collection);
        if (claimed==null) return null;
        return new Claim(claimed,token,((Number)claimed.get("attempts")).intValue());
    }
    public void complete(String collection,Claim claim,String status) {
        mongo.updateFirst(owned(claim),new Update().set("status",status).set("processedAt",clock.instant())
                .unset("leaseToken").unset("leaseUntil").unset("nextAttemptAt").unset("lastError"),collection);
    }
    public void retry(String collection,Claim claim,RuntimeException failure) {
        long delay=Math.min(3600,retrySeconds*(1L << Math.min(10,Math.max(0,claim.attempt()-1))));
        mongo.updateFirst(owned(claim),new Update().set("status","RETRY").set("nextAttemptAt",clock.instant().plusSeconds(delay))
                .set("lastError",failure.getClass().getSimpleName()).unset("leaseToken").unset("leaseUntil"),collection);
    }
    private Query owned(Claim claim) {
        return Query.query(Criteria.where("_id").is(claim.document().get("_id"))
                .and("leaseToken").is(claim.token()).and("status").is("PROCESSING"));
    }
}
