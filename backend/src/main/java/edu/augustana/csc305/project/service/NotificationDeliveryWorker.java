package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.model.NotificationInboxEntry;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;

/** Persist first, publish later. Failed/offline live delivery never rolls back moderation or hides the inbox entry. */
@Service
public class NotificationDeliveryWorker {
    public static final String COLLECTION="notificationInbox";
    private final MongoTemplate mongo;
    private final NotificationLeaseQueue leases;
    private final NotificationInboxService inbox;
    private final NotificationPublisher publisher;
    private final int batchSize;
    public NotificationDeliveryWorker(MongoTemplate mongo,NotificationLeaseQueue leases,NotificationInboxService inbox,
            NotificationPublisher publisher,@Value("${app.notifications.batch-size:50}") int batchSize) {
        if (batchSize<1 || batchSize>500) throw new IllegalArgumentException("Notification batch size must be 1 to 500.");
        this.mongo=mongo; this.leases=leases; this.inbox=inbox; this.publisher=publisher; this.batchSize=batchSize;
    }
    public int processBatch() {
        int delivered=0;
        for (int i=0;i<batchSize;i++) {
            var claim=leases.claim(COLLECTION); if (claim==null) break;
            try {
                var entry=mongo.getConverter().read(NotificationInboxEntry.class,claim.document());
                publisher.publish(entry.recipientId(),inbox.view(entry));
                leases.complete(COLLECTION,claim,"DELIVERED"); delivered++;
            } catch (RuntimeException failure) { leases.retry(COLLECTION,claim,failure); }
        }
        return delivered;
    }
}
