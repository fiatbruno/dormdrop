
package edu.augustana.csc305.project.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public record CreateListingRequest(
        @NotBlank String title,
        @NotBlank String description,
        @NotBlank String category,
        @NotNull @DecimalMin("0.00") BigDecimal price,
        @NotBlank String condition,
        @NotBlank String pickupArea,
        @Pattern(regexp = "For sale|Free / Donate|Trade")
        String listingType
) {}
