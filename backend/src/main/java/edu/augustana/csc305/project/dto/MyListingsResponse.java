
package edu.augustana.csc305.project.dto;

import edu.augustana.csc305.project.model.Listing;

import java.util.List;

public record MyListingsResponse(
        List<Listing> activeListings,
        List<Listing> soldListings
) {

}
