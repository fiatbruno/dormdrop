
package edu.augustana.csc305.project.repository;

import edu.augustana.csc305.project.model.PickupProposal;
import edu.augustana.csc305.project.model.PickupStatus;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface PickupProposalRepository
        extends MongoRepository<PickupProposal, ObjectId> {

    // Get all pickup proposals for a conversation,
    // ordered from oldest to newest
    List<PickupProposal> findByConversationIdOrderByTimeCreatedAsc(
            ObjectId conversationId
    );

    // Find pickup proposals by conversation and status
    List<PickupProposal> findByConversationIdAndStatus(
            ObjectId conversationId,
            PickupStatus status
    );
}
