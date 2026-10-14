
package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.dto.PickupProposalRequest;
import edu.augustana.csc305.project.model.PickupProposal;
import edu.augustana.csc305.project.model.PickupStatus;
import edu.augustana.csc305.project.service.PickupProposalService;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/conversations/{conversationId}/pickup-proposals")
public class PickupProposalController {

    private final PickupProposalService service;

    public PickupProposalController(
            PickupProposalService service
    ) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PickupProposal createProposal(
            @PathVariable String conversationId,
            @Valid @RequestBody PickupProposalRequest request,
            Authentication authentication
    ) {
        return service.createProposal(
                conversationId,
                authentication.getName(),
                request
        );
    }

    @GetMapping
    public List<PickupProposal> getProposals(
            @PathVariable String conversationId,
            Authentication authentication
    ) {
        return service.getProposals(
                conversationId,
                authentication.getName()
        );
    }

    @PatchMapping("/{proposalId}/respond")
    public PickupProposal respondToProposal(
            @PathVariable String conversationId,
            @PathVariable String proposalId,
            @RequestParam PickupStatus decision,
            Authentication authentication
    ) {
        return service.respondToProposal(
                conversationId,
                proposalId,
                authentication.getName(),
                decision
        );
    }
}
