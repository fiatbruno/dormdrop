
package edu.augustana.csc305.project.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record SavedListingResponse(
        String id,
        String title,
        String category,
        BigDecimal price,
        String imageUrl,
        String status,
        boolean available,
        Instant savedAt
) {}
