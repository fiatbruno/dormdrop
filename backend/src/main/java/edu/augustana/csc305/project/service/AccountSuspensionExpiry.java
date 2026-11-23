package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.model.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionOperations;

import java.time.Instant;

@Component
public class AccountSuspensionExpiry {
    private final MongoTemplate mongo;
    private final TransactionOperations transactions;

    public AccountSuspensionExpiry(MongoTemplate mongo,
                                   @Qualifier("reportTransactions") TransactionOperations transactions) {
        this.mongo = mongo;
        this.transactions = transactions;
    }

    @Scheduled(fixedDelayString = "${app.suspensions.expiry-check-ms:60000}")
    public void restoreExpiredSuspensions() {
        Instant now = Instant.now();
        var due = mongo.find(Query.query(Criteria.where("suspendedUntil").lte(now)), User.class);
        for (User user : due) {
            var suspensionReportId = user.getSuspensionReportId();
            transactions.executeWithoutResult(status -> {
                long cleared = mongo.updateFirst(Query.query(Criteria.where("_id").is(user.getId())
                                .and("suspensionReportId").is(suspensionReportId)
                                .and("suspendedUntil").lte(now)),
                        new Update().unset("suspendedUntil").unset("suspensionReportId"), User.class)
                        .getModifiedCount();
                if (cleared == 0 || suspensionReportId == null) return;

                mongo.updateMulti(Query.query(Criteria.where("ownerId").is(user.getId())
                                .and("accountSuspensionId").is(suspensionReportId)
                                .and("moderationVisibility").is(ModerationTypes.Visibility.HIDDEN)
                                .and("temporaryHideCaseId").is(null)),
                        new Update().set("moderationVisibility", ModerationTypes.Visibility.VISIBLE)
                                .unset("accountSuspensionId").inc("version", 1L),
                        Listing.class);
                mongo.updateMulti(Query.query(Criteria.where("ownerId").is(user.getId())
                                .and("accountSuspensionId").is(suspensionReportId)),
                        new Update().unset("accountSuspensionId").inc("version", 1L), Listing.class);
            });
        }
    }
}
