
package edu.augustana.csc305.project.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public record PickupProposalRequest(

        @NotBlank
        String meetingPlace,

        @NotNull
        LocalDateTime timePickup,

        @Size(max = 600)
        String note

) {}
