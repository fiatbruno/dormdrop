package edu.augustana.csc305.project.service;

import org.slf4j.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix="app.notifications",name="worker-enabled",havingValue="true",matchIfMissing=true)
public class NotificationScheduler {
    private static final Logger log=LoggerFactory.getLogger(NotificationScheduler.class);
    private final ModerationOutboxConsumer consumer;
    private final NotificationDeliveryWorker deliveries;
    public NotificationScheduler(ModerationOutboxConsumer consumer,NotificationDeliveryWorker deliveries) {
        this.consumer=consumer; this.deliveries=deliveries;
    }
    @Scheduled(fixedDelayString="${app.notifications.poll-ms:5000}",initialDelayString="${app.notifications.poll-ms:5000}")
    public void tick() {
        try { consumer.processBatch(); } catch (RuntimeException failure) { log.warn("Moderation notice polling failed; will retry."); }
        try { deliveries.processBatch(); } catch (RuntimeException failure) { log.warn("Notification delivery polling failed; will retry."); }
    }
}
