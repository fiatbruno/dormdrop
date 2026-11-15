package edu.augustana.csc305.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SubmitMessageReportRequest(
        @NotBlank @Size(max = 500) String reason,
        @Size(max = 2000) String details
) {}
