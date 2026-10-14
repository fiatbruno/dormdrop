package edu.augustana.csc305.project.dto;
import jakarta.validation.constraints.NotBlank;
public record StartConversationRequest (
    @NotBlank String listingId){

}



