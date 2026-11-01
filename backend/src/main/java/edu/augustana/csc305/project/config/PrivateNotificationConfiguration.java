package edu.augustana.csc305.project.config;

import com.mongodb.client.model.IndexOptions;
import com.mongodb.client.model.Indexes;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.time.Clock;

@Configuration
@EnableScheduling
public class PrivateNotificationConfiguration {
    @Bean("notificationClock")
    public Clock notificationClock() { return Clock.systemUTC(); }

    @Bean
    public ApplicationRunner notificationIndexes(MongoTemplate mongo) {
        return args -> initialize(mongo);
    }

    /** Additive v1 indexes; safe to rerun. No listing migration or historical date backfill. */
    public static void initialize(MongoTemplate mongo) {
        var notifications = mongo.getCollection("notifications");
        notifications.createIndex(Indexes.ascending("recipientId", "sourceEventKey"),
                new IndexOptions().unique(true).name("notification_recipient_event_v1"));
        notifications.createIndex(Indexes.compoundIndex(Indexes.ascending("recipientId"), Indexes.descending("createdAt", "_id")),
                new IndexOptions().name("notification_inbox_v1"));
        notifications.createIndex(Indexes.ascending("recipientId", "readAt"),
                new IndexOptions().name("notification_unread_v1"));
        var outbox = mongo.getCollection("notificationOutbox");
        outbox.createIndex(Indexes.ascending("eventKey"), new IndexOptions().unique(true).name("notification_event_key_v1"));
        outbox.createIndex(Indexes.ascending("status", "nextAttemptAt", "createdAt", "_id"),
                new IndexOptions().name("notification_retry_v1"));
        outbox.createIndex(Indexes.ascending("status", "leaseUntil"),
                new IndexOptions().name("notification_expired_lease_v1"));
    }
}
