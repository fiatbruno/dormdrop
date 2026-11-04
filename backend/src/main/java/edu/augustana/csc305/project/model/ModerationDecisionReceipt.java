package edu.augustana.csc305.project.model;

import edu.augustana.csc305.project.dto.ModerationDecisionDtos;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;

@Document("moderationDecisionRequests")
public record ModerationDecisionReceipt(@Id String id, String fingerprint,
                                         ModerationDecisionDtos.Result result, Instant createdAt) {}
