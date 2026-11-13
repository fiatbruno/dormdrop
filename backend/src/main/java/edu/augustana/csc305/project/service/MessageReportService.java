package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.dto.MessageReportDtos;
import edu.augustana.csc305.project.dto.SubmitMessageReportRequest;
import edu.augustana.csc305.project.model.Conversation;
import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.model.Message;
import edu.augustana.csc305.project.model.MessageReport;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.MessageReportRepository;
import edu.augustana.csc305.project.repository.MessageRepository;
import edu.augustana.csc305.project.repository.UserRepository;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@Service
public class MessageReportService {
    private static final int CONTEXT_RADIUS = 3;

    private final ConversationService conversations;
    private final MessageRepository messages;
    private final MessageReportRepository reports;
    private final UserRepository users;
    private final MongoTemplate mongo;

    public MessageReportService(
            ConversationService conversations,
            MessageRepository messages,
            MessageReportRepository reports,
            UserRepository users,
            MongoTemplate mongo
    ) {
        this.conversations = conversations;
        this.messages = messages;
        this.reports = reports;
        this.users = users;
        this.mongo = mongo;
    }

    public MessageReportDtos.Receipt submit(
            String conversationId,
            String messageId,
            SubmitMessageReportRequest request,
            Authentication authentication
    ) {
        if (request == null || request.reason() == null || request.reason().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A report reason is required.");
        }
        if (request.reason().length() > 500
                || (request.details() != null && request.details().length() > 2000)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Report reason or details are too long.");
        }

        Conversation conversation = conversations.getConversation(conversationId, authentication.getName());
        if (!ObjectId.isValid(messageId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid message ID.");
        }
        Message reportedMessage = messages.findById(new ObjectId(messageId))
                .filter(message -> conversation.getId().equals(message.getConversationId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found in this conversation."));

        User reporter = user(authentication.getName());
        User sender = user(reportedMessage.getSenderId());
        User buyer = user(conversation.getBuyerId());
        User seller = user(conversation.getSellerId());
        Listing listing = mongo.findById(conversation.getListingId(), Listing.class);

        List<Message> thread = messages.findByConversationIdOrderBySentAtAsc(conversation.getId());
        int messageIndex = -1;
        for (int index = 0; index < thread.size(); index++) {
            if (thread.get(index).getId().equals(reportedMessage.getId())) {
                messageIndex = index;
                break;
            }
        }
        if (messageIndex < 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found in this conversation.");
        }

        int start = Math.max(0, messageIndex - CONTEXT_RADIUS);
        int end = Math.min(thread.size(), messageIndex + CONTEXT_RADIUS + 1);
        List<MessageReport.ContextMessage> context = thread.subList(start, end).stream()
                .map(message -> new MessageReport.ContextMessage(
                        message.getId(),
                        message.getSenderId().equals(buyer.getId()) ? buyer.getName() : seller.getName(),
                        message.getContent(),
                        message.getSentAt()))
                .toList();

        MessageReport report = reports.save(new MessageReport(
                null,
                conversation.getId(),
                conversation.getListingId(),
                listing == null ? "Listing unavailable" : listing.getTitle(),
                reportedMessage.getId(),
                reportedMessage.getContent(),
                reportedMessage.getSentAt(),
                sender.getId(),
                sender.getName(),
                sender.getEmail(),
                reporter.getId(),
                reporter.getName(),
                reporter.getEmail(),
                request.reason().strip(),
                request.details() == null || request.details().isBlank() ? null : request.details().strip(),
                context,
                Instant.now(),
                "OPEN"
        ));
        return new MessageReportDtos.Receipt(
                report.id().toHexString(),
                report.status(),
                report.createdAt()
        );
    }

    public List<MessageReportDtos.Report> adminQueue() {
        return reports.findAllByOrderByCreatedAtDesc().stream()
                .map(MessageReportDtos.Report::from)
                .toList();
    }

    private User user(String email) {
        return users.findByEmail(email).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found."));
    }

    private User user(ObjectId id) {
        return users.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation participant not found."));
    }
}
