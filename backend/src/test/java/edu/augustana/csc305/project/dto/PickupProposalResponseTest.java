package edu.augustana.csc305.project.dto;

import edu.augustana.csc305.project.model.PickupProposal;
import edu.augustana.csc305.project.model.PickupStatus;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import java.time.LocalDateTime;
import static org.junit.jupiter.api.Assertions.*;

class PickupProposalResponseTest {
    @Test
    void exposesCompleteIdsAndProposalStatus() {
        ObjectId id = new ObjectId();
        ObjectId conversation = new ObjectId();
        ObjectId sender = new ObjectId();
        PickupProposal proposal = new PickupProposal(conversation, sender, "Gerber Center", LocalDateTime.of(2099, 11, 12, 16, 0), "");
        proposal.setId(id);
        proposal.setStatus(PickupStatus.ACCEPTED);
        PickupProposalResponse response = PickupProposalResponse.from(proposal);
        assertEquals(id.toHexString(), response.id());
        assertEquals(conversation.toHexString(), response.conversationId());
        assertEquals(sender.toHexString(), response.idSuggester());
        assertEquals(PickupStatus.ACCEPTED, response.status());
        assertEquals("Gerber Center", response.meetingPlace());
    }
}
