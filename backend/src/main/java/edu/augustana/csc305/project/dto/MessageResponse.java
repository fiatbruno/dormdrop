package edu.augustana.csc305.project.dto;
import edu.augustana.csc305.project.model.Message;
import java.time.Instant;
public record MessageResponse(String id, String conversationId, String senderId, String content, Instant sentAt, Instant readAt) {
    public static MessageResponse from(Message message) {
        return new MessageResponse(message.getId().toHexString(), message.getConversationId().toHexString(),
                message.getSenderId().toHexString(), message.getContent(), message.getSentAt(), message.getReadAt());
    }
}
