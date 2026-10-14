
package edu.augustana.csc305.project.repository;

import edu.augustana.csc305.project.model.Conversation;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ConversationRepository
        extends MongoRepository<Conversation, ObjectId> {

    Optional<Conversation> findByListingIdAndBuyerId(
            ObjectId listingId,
            ObjectId buyerId
    );

    List<Conversation>
    findByBuyerIdOrSellerIdOrderByLastMessageAtDesc(
            ObjectId buyerId,
            ObjectId sellerId
    );
}
