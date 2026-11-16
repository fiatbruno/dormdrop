package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.model.*;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
public class AccountSuspensionExpiry {
    private final MongoTemplate mongo;

    public AccountSuspensionExpiry(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    @Scheduled(fixedDelayString = "${app.suspensions.expiry-check-ms:60000}")
    public void restoreExpiredSuspensions() {
        Instant now = Instant.now();
        var due = mongo.find(Query.query(Criteria.where("suspendedUntil").lte(now)), User.class);
        for (User user : due) {
            if (user.getSuspensionReportId() == null) {
                mongo.updateFirst(Query.query(Criteria.where("_id").is(user.getId())
                                .and("suspendedUntil").lte(now)),
                        new Update().unset("suspendedUntil"), User.class);
                continue;
            }
            mongo.updateMulti(Query.query(Criteria.where("ownerId").is(user.getId())
                            .and("accountSuspensionId").is(user.getSuspensionReportId())
                            .and("moderationVisibility").is(ModerationTypes.Visibility.HIDDEN)),
                    new Update().set("moderationVisibility", ModerationTypes.Visibility.VISIBLE)
                            .unset("accountSuspensionId").inc("version", 1L),
                    Listing.class);
            mongo.updateMulti(Query.query(Criteria.where("ownerId").is(user.getId())
                            .and("accountSuspensionId").is(user.getSuspensionReportId())),
                    new Update().unset("accountSuspensionId"), Listing.class);
            mongo.updateFirst(Query.query(Criteria.where("_id").is(user.getId())
                            .and("suspensionReportId").is(user.getSuspensionReportId())
                            .and("suspendedUntil").lte(now)),
                    new Update().unset("suspendedUntil").unset("suspensionReportId"), User.class);
        }
    }
}
