
package edu.augustana.csc305.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SendMessageRequest(

        @NotBlank(message = "Message cannot be empty.")
        @Size(max = 5000, message = "Message is too long.")
        String content

) {}
