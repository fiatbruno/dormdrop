
package edu.augustana.csc305.project.dto;

import edu.augustana.csc305.project.model.PickupProposal;
import edu.augustana.csc305.project.model.PickupStatus;

import java.time.Instant;
import java.time.LocalDateTime;

public record PickupProposalResponse(
        String id,
        String conversationId,
        String idSuggester,
        String meetingPlace,
        LocalDateTime timePickUp,
        String meetingNote,
        PickupStatus status,
        Instant timeCreated,
        Instant timeResponded
) {
    public static PickupProposalResponse from(PickupProposal proposal) {
        return new PickupProposalResponse(
                proposal.getId() == null
                        ? null
                        : proposal.getId().toHexString(),
                proposal.getConversationId() == null
                        ? null
                        : proposal.getConversationId().toHexString(),
                proposal.getIdSuggester() == null
                        ? null
                        : proposal.getIdSuggester().toHexString(),
                proposal.getMeetingPlace(),
                proposal.getTimePickUp(),
                proposal.getMeetingNote(),
                proposal.getStatus(),
                proposal.getTimeCreated(),
                proposal.getTimeResponded()
        );
    }
}
