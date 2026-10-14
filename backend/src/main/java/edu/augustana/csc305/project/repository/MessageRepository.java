
package edu.augustana.csc305.project.repository;

import edu.augustana.csc305.project.model.Message;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface MessageRepository
        extends MongoRepository<Message, ObjectId> {

    List<Message> findByConversationIdOrderBySentAtAsc(
            ObjectId conversationId
    );

    long countByConversationIdAndSenderIdNotAndReadAtIsNull(
            ObjectId conversationId,
            ObjectId senderId
    );

    List<Message> findByConversationIdAndSenderIdNotAndReadAtIsNull(
            ObjectId conversationId,
            ObjectId senderId
    );
}
