package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.dto.NotificationResponse;
import edu.augustana.csc305.project.model.PrivateNotification;
import edu.augustana.csc305.project.model.NotificationOutboxEvent;
import edu.augustana.csc305.project.repository.UserRepository;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.util.HexFormat;

@Service
public class PrivateNotificationService {
    private final MongoTemplate mongo;
    private final UserRepository users;
    private final Clock clock;

    public PrivateNotificationService(MongoTemplate mongo, UserRepository users,
                                      @Qualifier("notificationClock") Clock clock) {
        this.mongo = mongo;
        this.users = users;
        this.clock = clock;
    }

    public static String notificationId(String eventKey, ObjectId recipient) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(
                    (recipient.toHexString() + ":" + eventKey).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    /** A replay cannot change the payload, timestamp or read state of an existing notice. */
    public void persist(NotificationOutboxEvent event) {
        String id = notificationId(event.eventKey(), event.recipientId());
        Update fields = new Update().setOnInsert("recipientId", event.recipientId())
                .setOnInsert("sourceEventKey", event.eventKey()).setOnInsert("type", event.type())
                .setOnInsert("offerId", event.offerId()).setOnInsert("listingId", event.listingId())
                .setOnInsert("payload", event.payload()).setOnInsert("createdAt", event.createdAt())
                .setOnInsert("readAt", null);
        try {
            mongo.upsert(Query.query(Criteria.where("_id").is(id)), fields, PrivateNotification.class);
        } catch (DuplicateKeyException race) {
            // Concurrent upserts may race on the recipient/source unique index.
            if (!mongo.exists(Query.query(Criteria.where("_id").is(id)
                    .and("recipientId").is(event.recipientId()).and("sourceEventKey").is(event.eventKey())),
                    PrivateNotification.class)) throw race;
        }
    }

    public NotificationResponse.Page list(Authentication authentication, int page, int size) {
        ObjectId recipient = recipient(authentication);
        if (page < 0 || size < 1 || size > 100)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Page must be nonnegative and size must be 1 to 100.");
        long total = mongo.count(owned(recipient), PrivateNotification.class);
        long unread = unreadCount(recipient);
        var items = mongo.find(owned(recipient).with(Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("_id")))
                .skip((long) page * size).limit(size), PrivateNotification.class)
                .stream().map(NotificationResponse::from).toList();
        return new NotificationResponse.Page(items, total, unread, page, size);
    }

    public NotificationResponse.UnreadCount unreadCount(Authentication authentication) {
        return new NotificationResponse.UnreadCount(unreadCount(recipient(authentication)));
    }

    public NotificationResponse read(Authentication authentication, String id) {
        ObjectId recipient = recipient(authentication);
        if (id == null || !id.matches("[a-f0-9]{64}")) throw missing();
        // The null predicate makes the first read time stable, including concurrent readers.
        mongo.updateFirst(owned(recipient).addCriteria(Criteria.where("_id").is(id).and("readAt").is(null)),
                new Update().set("readAt", clock.instant()), PrivateNotification.class);
        var notice = mongo.findOne(owned(recipient).addCriteria(Criteria.where("_id").is(id)), PrivateNotification.class);
        if (notice == null) throw missing();
        return NotificationResponse.from(notice);
    }

    private long unreadCount(ObjectId recipient) {
        return mongo.count(owned(recipient).addCriteria(Criteria.where("readAt").is(null)), PrivateNotification.class);
    }

    private Query owned(ObjectId recipient) { return Query.query(Criteria.where("recipientId").is(recipient)); }

    private ObjectId recipient(Authentication auth) {
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken)
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required.");
        return users.findByEmail(auth.getName()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found.")).getId();
    }

    private ResponseStatusException missing() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found.");
    }
}
