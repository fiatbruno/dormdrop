package edu.augustana.csc305.project.service;

import com.mongodb.client.result.UpdateResult;
import edu.augustana.csc305.project.dto.MessageReportActionDtos;
import edu.augustana.csc305.project.dto.MessageReportDtos;
import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.*;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

import static edu.augustana.csc305.project.dto.MessageReportActionDtos.*;

@Service
public class MessageReportReviewService {
    private final MongoTemplate mongo;
    private final MessageReportRepository reports;
    private final MessageReportActionRepository actions;
    private final UserRepository users;
    private final TransactionOperations transactions;

    public MessageReportReviewService(
            MongoTemplate mongo,
            MessageReportRepository reports,
            MessageReportActionRepository actions,
            UserRepository users,
            @Qualifier("reportTransactions") TransactionOperations transactions
    ) {
        this.mongo = mongo;
        this.reports = reports;
        this.actions = actions;
        this.users = users;
        this.transactions = transactions;
    }

    public List<MessageReportActionDtos.Report> queue() {
        return reports.findAllByOrderByCreatedAtDesc().stream().map(report ->
                new MessageReportActionDtos.Report(
                        report.id().toHexString(),
                        report.conversationId().toHexString(),
                        report.listingId().toHexString(),
                        report.listingTitle(),
                        report.messageId().toHexString(),
                        report.messageContent(),
                        report.messageSentAt(),
                        report.senderName(),
                        report.senderEmail(),
                        report.reporterName(),
                        report.reporterEmail(),
                        report.reason(),
                        report.details(),
                        report.conversationContext().stream().map(message ->
                                new MessageReportDtos.ContextMessage(
                                        message.messageId().toHexString(),
                                        message.senderName(),
                                        message.content(),
                                        message.sentAt())).toList(),
                        report.createdAt(),
                        report.status(),
                        actions.findByReportIdAndTypeOrderByCreatedAtAsc(
                                        report.id(), MessageReportAction.Type.INTERNAL_NOTE)
                                .stream().map(note -> new InternalNote(
                                        note.actorName(), note.content(), note.createdAt())).toList(),
                        actions.findByReportIdAndTypeOrderByCreatedAtAsc(
                                        report.id(), MessageReportAction.Type.ACCOUNT_SUSPENDED)
                                .stream().reduce((first, second) -> second)
                                .map(MessageReportAction::expiresAt).orElse(null),
                        mongo.count(Query.query(Criteria.where("accountSuspensionId").is(report.id())), Listing.class)
                )).toList();
    }

    public Receipt addNote(String id, NoteRequest request, Authentication auth) {
        return transactions.execute(status -> {
            MessageReport report = openReport(id);
            User actor = actor(auth);
            Instant now = Instant.now();
            actions.save(new MessageReportAction(new ObjectId(), report.id(), actor.getId(), actor.getName(),
                    MessageReportAction.Type.INTERNAL_NOTE, request.content().strip(), null, null, null, now));
            return new Receipt(report.id().toHexString(), report.status(), now, null, 0);
        });
    }

    public Receipt dismiss(String id, DismissRequest request, Authentication auth) {
        return transactions.execute(status -> {
            MessageReport report = openReport(id);
            User actor = actor(auth);
            Instant now = Instant.now();
            changeStatus(report, "DISMISSED");
            actions.save(new MessageReportAction(new ObjectId(), report.id(), actor.getId(), actor.getName(),
                    MessageReportAction.Type.DISMISSED, request.internalNote().strip(),
                    request.reason().strip(), null, null, now));
            actions.save(new MessageReportAction(new ObjectId(), report.id(), actor.getId(), actor.getName(),
                    MessageReportAction.Type.INTERNAL_NOTE, request.internalNote().strip(),
                    null, null, null, now));
            return new Receipt(report.id().toHexString(), "DISMISSED", now, null, 0);
        });
    }

    public Receipt warn(String id, WarningRequest request, Authentication auth) {
        return transactions.execute(status -> {
            MessageReport report = openReport(id);
            User actor = actor(auth);
            User member = member(report);
            Instant now = Instant.now();
            changeStatus(report, "WARNING_SENT");
            actions.save(new MessageReportAction(new ObjectId(), report.id(), actor.getId(), actor.getName(),
                    MessageReportAction.Type.WARNING_SENT, request.message().strip(),
                    request.policyReason().strip(), null, null, now));
            enqueueNotice(member, report, request.message().strip(),
                    PrivateNotification.Status.POLICY_WARNING, request.policyReason().strip(), now);
            return new Receipt(report.id().toHexString(), "WARNING_SENT", now, null, 0);
        });
    }

    public Receipt suspend(String id, SuspensionRequest request, Authentication auth) {
        return transactions.execute(status -> {
            MessageReport report = openReport(id);
            User actor = actor(auth);
            User member = member(report);
            Instant now = Instant.now();
            Instant expiresAt = now.plusSeconds(request.durationDays() * 24L * 60L * 60L);
            changeStatus(report, "SUSPENDED");

            if (member.getSuspensionReportId() != null) {
                mongo.updateMulti(Query.query(Criteria.where("ownerId").is(member.getId())
                                .and("accountSuspensionId").is(member.getSuspensionReportId())),
                        new Update().set("accountSuspensionId", report.id()).inc("version", 1L), Listing.class);
            }
            Update userUpdate = new Update().set("suspendedUntil", expiresAt)
                    .set("suspensionReportId", report.id());
            mongo.updateFirst(Query.query(Criteria.where("_id").is(member.getId())), userUpdate, User.class);
            Query activeVisible = Query.query(Criteria.where("ownerId").is(member.getId())
                    .and("moderationVisibility").in("VISIBLE", null))
                    .addCriteria(activeListingCriteria());
            Update hide = new Update().set("moderationVisibility", ModerationTypes.Visibility.HIDDEN)
                    .set("accountSuspensionId", report.id()).inc("version", 1L);
            long hiddenListings = mongo.updateMulti(activeVisible, hide, Listing.class).getModifiedCount();
            Query reportHidden = Query.query(Criteria.where("ownerId").is(member.getId())
                    .and("moderationVisibility").is(ModerationTypes.Visibility.HIDDEN)
                    .and("temporaryHideCaseId").ne(null)
                    .and("accountSuspensionId").is(null))
                    .addCriteria(activeListingCriteria());
            mongo.updateMulti(reportHidden, new Update().set("accountSuspensionId", report.id())
                    .inc("version", 1L), Listing.class);

            actions.save(new MessageReportAction(new ObjectId(), report.id(), actor.getId(), actor.getName(),
                    MessageReportAction.Type.ACCOUNT_SUSPENDED, request.message().strip(),
                    request.policyReason().strip(), request.durationDays(), expiresAt, now));
            enqueueNotice(member, report, request.message().strip(),
                    PrivateNotification.Status.ACCOUNT_SUSPENDED, request.policyReason().strip(), now);
            return new Receipt(report.id().toHexString(), "SUSPENDED", now, expiresAt, hiddenListings);
        });
    }

    private Criteria activeListingCriteria() {
        return new Criteria().orOperator(
                Criteria.where("status").in(ListingStatus.AVAILABLE, ListingStatus.RESERVED),
                Criteria.where("status").exists(false));
    }

    private void enqueueNotice(User member, MessageReport report, String message,
                               PrivateNotification.Status state, String reason, Instant createdAt) {
        ObjectId eventId = new ObjectId();
        PrivateNotification.Payload payload = new PrivateNotification.Payload(
                message, state, null, reason, null, "/notifications");
        mongo.insert(new NotificationOutboxEvent(
                eventId, "message-report:" + report.id().toHexString() + ":" + state.name(),
                member.getId(), PrivateNotification.Type.MODERATION_NOTICE, null, null,
                payload, createdAt, "PENDING"));
    }

    private void changeStatus(MessageReport report, String next) {
        UpdateResult result = mongo.updateFirst(Query.query(Criteria.where("_id").is(report.id())
                        .and("status").is("OPEN")),
                new Update().set("status", next), MessageReport.class);
        if (result.getModifiedCount() != 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This report has already been reviewed.");
        }
    }

    private MessageReport openReport(String id) {
        if (id == null || !ObjectId.isValid(id)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid message report ID.");
        }
        MessageReport report = reports.findById(new ObjectId(id)).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Message report not found."));
        if (!"OPEN".equals(report.status())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This report has already been reviewed.");
        }
        return report;
    }

    private User actor(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required.");
        }
        return users.findByEmail(auth.getName()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found."));
    }

    private User member(MessageReport report) {
        return users.findById(report.senderId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Reported member not found."));
    }
}
