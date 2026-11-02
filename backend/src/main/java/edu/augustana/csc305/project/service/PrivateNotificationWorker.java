package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.model.NotificationOutboxEvent;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Materializes committed outbox records. Persistence and acknowledgment may safely be retried separately. */
@Component
@ConditionalOnProperty(name = "app.notifications.worker-enabled", havingValue = "true", matchIfMissing = true)
public class PrivateNotificationWorker {
    public static final String COLLECTION = "notificationOutbox";
    private final MongoTemplate mongo;
    private final NotificationLeaseQueue queue;
    private final PrivateNotificationService notifications;
    private final int batchSize;

    public PrivateNotificationWorker(MongoTemplate mongo, NotificationLeaseQueue queue,
                                     PrivateNotificationService notifications,
                                     @Value("${app.notifications.batch-size:50}") int batchSize) {
        if (batchSize < 1 || batchSize > 500) throw new IllegalArgumentException("Notification batch size must be 1 to 500.");
        this.mongo = mongo;
        this.queue = queue;
        this.notifications = notifications;
        this.batchSize = batchSize;
    }

    @Scheduled(fixedDelayString = "${app.notifications.poll-ms:5000}", initialDelayString = "${app.notifications.poll-ms:5000}")
    public void poll() {
        for (int i = 0; i < batchSize; i++) if (!processOne()) break;
    }

    public boolean processOne() {
        var claim = queue.claim(COLLECTION);
        if (claim == null) return false;
        try {
            NotificationOutboxEvent event = mongo.getConverter().read(NotificationOutboxEvent.class, claim.document());
            notifications.persist(event);
            queue.complete(COLLECTION, claim, "DONE");
        } catch (RuntimeException failure) {
            // Store only the exception class, never messages containing payloads, secrets or database URIs.
            queue.retry(COLLECTION, claim, failure);
        }
        return true;
    }
}
