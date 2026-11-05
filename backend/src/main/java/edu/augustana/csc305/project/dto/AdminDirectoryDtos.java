package edu.augustana.csc305.project.dto;

import edu.augustana.csc305.project.model.UserRole;
import java.time.Instant;
import java.util.List;

/** Only the fields administrators need to view the member directory. */
public final class AdminDirectoryDtos {
    private AdminDirectoryDtos() { }

    public record Member(String id, String name, String maskedEmail, boolean emailVerified,
                         UserRole role, Instant createdAt, Instant updatedAt, Instant lastActiveAt, boolean active) { }
    public record Page(List<Member> items, long total, int page, int size, long totalPages, long activeCount) { }
}
