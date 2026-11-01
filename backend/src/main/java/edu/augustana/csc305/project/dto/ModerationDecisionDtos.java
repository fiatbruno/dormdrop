package edu.augustana.csc305.project.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import edu.augustana.csc305.project.model.ModerationTypes.*;
import jakarta.validation.constraints.*;
import java.time.Instant;

public final class ModerationDecisionDtos {
    private ModerationDecisionDtos() {}
    public record Request(@NotNull DecisionAction action, @NotNull @Min(0) Long expectedVersion,
            @JsonAlias("reason") @NotBlank @Size(max=500) String policyReason,
            @JsonAlias({"internalNote", "internalDecisionNote"}) @NotBlank @Size(max=4000) String internalRationale,
            @Size(max=2000) String sellerMessage) {}
    /** Staff-only result. expectedVersion refers to case version on the case route, listing version on the listing route. */
    public record Result(String decisionId, String caseId, String referenceNumber, String listingId,
                          DecisionAction action, Visibility visibility, boolean listingDeleted,
                          Long caseVersion, Long listingVersion, Instant createdAt) {}
}
