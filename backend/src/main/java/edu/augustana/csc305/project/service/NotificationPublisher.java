package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.dto.NotificationDtos.Notice;
import org.bson.types.ObjectId;

/** Delivery adapter shared with notification infrastructure. Clients deduplicate live hints by notice.id. */
public interface NotificationPublisher { void publish(ObjectId recipientId,Notice notice); }
