package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.dto.ModerationDtos;
import edu.augustana.csc305.project.model.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.stereotype.Service;
import java.util.*;

/** Materializes committed outbox events; never participates in the decision transaction. */
@Service
public class ModerationOutboxConsumer {
    public static final String COLLECTION="moderationNotificationOutbox";
    private final MongoTemplate mongo;
    private final NotificationLeaseQueue leases;
    private final NotificationInboxService inbox;
    private final int batchSize;
    public ModerationOutboxConsumer(MongoTemplate mongo,NotificationLeaseQueue leases,NotificationInboxService inbox,
                                    @Value("${app.notifications.batch-size:50}") int batchSize) {
        if (batchSize<1 || batchSize>500) throw new IllegalArgumentException("Notification batch size must be 1 to 500.");
        this.mongo=mongo; this.leases=leases; this.inbox=inbox; this.batchSize=batchSize;
    }
    public int processBatch() {
        int completed=0;
        for (int i=0;i<batchSize;i++) {
            var claim=leases.claim(COLLECTION); if (claim==null) break;
            try {
                materialize(mongo.getConverter().read(ModerationNotificationEvent.class,claim.document()));
                leases.complete(COLLECTION,claim,"DONE"); completed++;
            } catch (RuntimeException failure) { leases.retry(COLLECTION,claim,failure); }
        }
        return completed;
    }
    private void materialize(ModerationNotificationEvent event) {
        ModerationDecision decision=mongo.findById(event.decisionId(),ModerationDecision.class);
        ModerationCase reportCase=mongo.findById(event.caseId(),ModerationCase.class);
        if (decision==null || reportCase==null || !event.id().equals(event.decisionId()) || !decision.caseId().equals(event.caseId())
                || !reportCase.listingId().equals(event.listingId()) || decision.action()!=event.action()
                || event.sellerRecipientId()==null) throw new IllegalStateException("Incomplete committed moderation event.");
        String reason=decision.policyReason()==null ? "Policy review" : decision.policyReason();
        String sellerId=NotificationInboxService.noticeId(event.id(),event.sellerRecipientId(),"SELLER",null);
        inbox.enqueue(new NotificationInboxEntry(sellerId,event.sellerRecipientId(),"SELLER",event.id(),event.action(),reason,
                decision.sellerMessage(),null,event.createdAt(),null));
        // Query only the reports actually reviewed by this decision and belonging to the listed recipient.
        for (var reporterId : new LinkedHashSet<>(event.reporterRecipientIds())) {
            var reports=mongo.find(Query.query(Criteria.where("_id").in(decision.reviewedReportIds())
                    .and("caseId").is(event.caseId()).and("reporterId").is(reporterId)),Report.class);
            for (Report report : reports) {
                var status=new ModerationDtos.ReporterStatus(report.id().toHexString(),reportCase.referenceNumber(),
                        event.action()==ModerationTypes.DecisionAction.HIDE ? ModerationTypes.CaseStatus.IN_REVIEW : ModerationTypes.CaseStatus.RESOLVED,
                        report.createdAt());
                String id=NotificationInboxService.noticeId(event.id(),reporterId,"REPORTER",report.id());
                inbox.enqueue(new NotificationInboxEntry(id,reporterId,"REPORTER",event.id(),event.action(),null,
                        decision.reporterMessage(),status,event.createdAt(),null));
            }
        }
    }
}
