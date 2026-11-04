package edu.augustana.csc305.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SubmitReportRequest(
        @NotBlank @Size(max = 64) String category,
        @NotBlank @Size(max = 2000) String description
) {}
