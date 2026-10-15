
package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.model.Conversation;
import edu.augustana.csc305.project.model.Message;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.ConversationRepository;
import edu.augustana.csc305.project.repository.MessageRepository;
import edu.augustana.csc305.project.repository.UserRepository;

import org.springframework.http.HttpStatus;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.bson.types.ObjectId;

@Service
public class MessageService {

    private static final Logger log = LoggerFactory.getLogger(MessageService.class);
    private final SimpMessagingTemplate messagingTemplate;

    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final ConversationService conversationService;
    private final UserRepository userRepository;

    public MessageService(
            MessageRepository messageRepository,
            ConversationRepository conversationRepository,
            ConversationService conversationService,
            UserRepository userRepository,
            SimpMessagingTemplate messagingTemplate
    ) {
        this.messageRepository = messageRepository;
        this.conversationRepository = conversationRepository;
        this.conversationService = conversationService;
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
    }

    public Message sendMessage(
            String conversationId,
            String userEmail,
            String content
    ) {
        Conversation conversation =
                conversationService.getConversation(
                        conversationId, userEmail
                );

        if (content == null || content.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Messages without characters are unacceptable."
            );
        }

        if (content.length() > 5000) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Message cannot exceed 5000 characters."
            );
        }

        User sender = getUserByEmail(userEmail);
        User buyer = getParticipant(conversation.getBuyerId());
        User seller = getParticipant(conversation.getSellerId());

        Message message = new Message(
                conversation.getId(),
                sender.getId(),
                content.trim()
        );

        Message savedMessage = messageRepository.save(message);

        conversation.setLastMessageAt(savedMessage.getSentAt());
        conversationRepository.save(conversation);

        Map<String, String> event = Map.of(
                "type", "MESSAGE_CREATED",
                "conversationId", conversation.getId().toHexString(),
                "messageId", savedMessage.getId().toHexString()
        );
        notifyParticipant(buyer, event);
        notifyParticipant(seller, event);

        return savedMessage;
    }


    public List<Message> getMessages(
            String conversationId,
            String userEmail
    ) {
        Conversation conversation =
                conversationService.getConversation(
                        conversationId, userEmail
                );

        return messageRepository
                .findByConversationIdOrderBySentAtAsc(
                        conversation.getId()
                );
    }


    public long getUnreadCount(
            String conversationId,
            String userEmail
    ) {
        Conversation conversation =
                conversationService.getConversation(
                        conversationId, userEmail
                );

        User user = getUserByEmail(userEmail);

        return messageRepository
                .countByConversationIdAndSenderIdNotAndReadAtIsNull(
                        conversation.getId(),
                        user.getId()
                );
    }


    public void markMessagesAsRead(
            String conversationId,
            String userEmail
    ) {
        Conversation conversation =
                conversationService.getConversation(
                        conversationId, userEmail
                );

        User user = getUserByEmail(userEmail);

        List<Message> unreadMessages = messageRepository
                .findByConversationIdAndSenderIdNotAndReadAtIsNull(
                        conversation.getId(),
                        user.getId()
                );

        Instant now = Instant.now();

        for (Message message : unreadMessages) {
            message.setReadAt(now);
        }

        messageRepository.saveAll(unreadMessages);
    }

    private User getParticipant(ObjectId id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Conversation participant not found."
                ));
    }

    private void notifyParticipant(User participant, Map<String, String> event) {
        try {
            messagingTemplate.convertAndSendToUser(
                    participant.getEmail(), "/queue/messages", event
            );
        } catch (MessagingException ex) {
            // Persistence succeeded; clients can recover the message through REST.
            log.warn("Live notification failed for message {}", event.get("messageId"), ex);
        }
    }

    private User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "User not found."
                ));
    }
}
