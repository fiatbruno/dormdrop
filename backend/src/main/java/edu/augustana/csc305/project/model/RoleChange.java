package edu.augustana.csc305.project.model;

import java.time.Instant;
import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/** Immutable audit entry, inserted only as part of a committed role change. */
@Document(collection = "role_changes")
public record RoleChange(@Id ObjectId id, ObjectId actorId, ObjectId targetId,
                         UserRole previousRole, UserRole newRole, Instant changedAt) { }
