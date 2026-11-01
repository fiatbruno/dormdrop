package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.dto.NotificationDtos.*;
import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.UserRepository;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.*;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.*;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Clock;
import java.util.*;

@Service
public class NotificationInboxService {
    private final MongoTemplate mongo;
    private final UserRepository users;
    private final Clock clock;
    private final String apiPrefix;
    public NotificationInboxService(MongoTemplate mongo,UserRepository users,
            @Qualifier("notificationClock") Clock clock,@Value("${api.prefix:/api/v1}") String apiPrefix) {
        this.mongo=mongo; this.users=users; this.clock=clock; this.apiPrefix=apiPrefix;
    }
    public static String noticeId(ObjectId eventId,ObjectId recipientId,String audience,ObjectId reportId) {
        try {
            String source=eventId.toHexString()+":"+recipientId.toHexString()+":"+audience+":"+(reportId==null?"":reportId.toHexString());
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(source.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
    /** Idempotent enqueue. Existing read/delivery state is never reset by a replay. */
    public void enqueue(NotificationInboxEntry entry) {
        if (!Set.of("SELLER","REPORTER").contains(entry.audience()) || entry.recipientId()==null
                || (entry.audience().equals("SELLER") && entry.reportStatus()!=null)
                || (entry.audience().equals("REPORTER") && (entry.reportStatus()==null || entry.reason()!=null)))
            throw new IllegalArgumentException("Invalid notification audience contract.");
        Update update=new Update().setOnInsert("recipientId",entry.recipientId()).setOnInsert("audience",entry.audience())
                .setOnInsert("sourceEventId",entry.sourceEventId()).setOnInsert("outcome",entry.outcome())
                .setOnInsert("reason",entry.reason()).setOnInsert("message",entry.message())
                .setOnInsert("reportStatus",entry.reportStatus()).setOnInsert("createdAt",entry.createdAt())
                .setOnInsert("readAt",null).setOnInsert("status","PENDING");
        mongo.upsert(Query.query(Criteria.where("_id").is(entry.id())),update,NotificationInboxEntry.class);
    }
    public Notice view(NotificationInboxEntry entry) {
        // Self link is an authenticated, owner-scoped API resource, usable even if the original listing is deleted.
        String link=apiPrefix+"/me/notifications/"+entry.id();
        if (entry.audience().equals("SELLER")) return new SellerNotice(entry.id(),"MODERATION_SELLER_NOTICE",entry.outcome(),
                entry.reason(),entry.message(),link,entry.createdAt(),entry.readAt());
        if (entry.audience().equals("REPORTER")) return new ReporterUpdate(entry.id(),"MODERATION_REPORT_UPDATE",entry.outcome(),
                entry.message(),link,entry.reportStatus(),entry.createdAt(),entry.readAt());
        throw new IllegalStateException("Unsupported notification audience.");
    }
    public InboxPage list(Authentication auth,int page,int size,boolean unreadOnly) {
        User user=current(auth);
        if (page<0 || size<1 || size>100) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Page must be nonnegative and size 1 to 100.");
        Criteria filter=recipient(user.getId()); if (unreadOnly) filter.and("readAt").is(null);
        long total=mongo.count(Query.query(filter),NotificationInboxEntry.class);
        long unread=mongo.count(Query.query(recipient(user.getId()).and("readAt").is(null)),NotificationInboxEntry.class);
        var items=mongo.find(Query.query(filter).with(Sort.by(Sort.Order.desc("createdAt"),Sort.Order.desc("_id")))
                .skip((long)page*size).limit(size),NotificationInboxEntry.class).stream().map(this::view).toList();
        return new InboxPage(items,total,unread,page,size);
    }
    public Notice get(Authentication auth,String id) { return view(owned(current(auth),id)); }
    public Notice read(Authentication auth,String id) {
        User user=current(auth); NotificationInboxEntry entry=owned(user,id);
        if (entry.readAt()==null) {
            mongo.updateFirst(Query.query(recipient(user.getId()).and("_id").is(id).and("readAt").is(null)),
                    new Update().set("readAt",clock.instant()),NotificationInboxEntry.class);
            entry=owned(user,id);
        }
        return view(entry);
    }
    private NotificationInboxEntry owned(User user,String id) {
        if (id==null || !id.matches("[a-f0-9]{64}")) throw missing();
        NotificationInboxEntry entry=mongo.findOne(Query.query(recipient(user.getId()).and("_id").is(id)),NotificationInboxEntry.class);
        if (entry==null) throw missing(); return entry;
    }
    private Criteria recipient(ObjectId id) { return Criteria.where("recipientId").is(id).and("audience").in("SELLER","REPORTER"); }
    private User current(Authentication auth) {
        if (auth==null || !auth.isAuthenticated()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Login required.");
        return users.findByEmail(auth.getName()).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED,"User not found."));
    }
    private ResponseStatusException missing() { return new ResponseStatusException(HttpStatus.NOT_FOUND,"Notification not found."); }
}
