package edu.augustana.csc305.project.dto;

public record ResetPasswordRequest(
        String token,
        String newPassword,
        String confirmPassword
) {
}
