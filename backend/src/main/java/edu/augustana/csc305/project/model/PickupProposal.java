
package edu.augustana.csc305.project.model;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDateTime;

@Document(collection = "pickup_proposals")
public class PickupProposal {

    @Id
    private ObjectId id;

    private ObjectId conversationId;
    private ObjectId idSuggester;
    private String meetingPlace;
    private LocalDateTime timePickUp;
    private String meetingNote;
    private PickupStatus status;
    private Instant timeCreated;
    private Instant timeResponded;

    // Required by Spring Data MongoDB
    public PickupProposal() {
    }

    // Constructor for creating a pickup proposal
    public PickupProposal(
            ObjectId idConversation,
            ObjectId idSuggester,
            String meetingPlace,
            LocalDateTime timePickUp,
            String meetingNote
    ) {
        this.conversationId = idConversation;
        this.idSuggester = idSuggester;
        this.meetingPlace = meetingPlace;
        this.timePickUp = timePickUp;
        this.meetingNote = meetingNote;
        this.status = PickupStatus.PENDING;
        this.timeCreated = Instant.now();
        this.timeResponded = null;
    }

    public ObjectId getId() {
        return id;
    }

    public void setId(ObjectId id) {
        this.id = id;
    }

    public ObjectId getConversationId() {
        return conversationId;
    }

    public void setConversationId(ObjectId conversationId) {
        this.conversationId = conversationId;
    }

    public ObjectId getIdSuggester() {
        return idSuggester;
    }

    public void setIdSuggester(ObjectId idSuggester) {
        this.idSuggester = idSuggester;
    }

    public String getMeetingPlace() {
        return meetingPlace;
    }

    public void setMeetingPlace(String meetingPlace) {
        this.meetingPlace = meetingPlace;
    }

    public LocalDateTime getTimePickUp() {
        return timePickUp;
    }

    public void setTimePickUp(LocalDateTime timePickUp) {
        this.timePickUp = timePickUp;
    }

    public String getMeetingNote() {
        return meetingNote;
    }

    public void setMeetingNote(String meetingNote) {
        this.meetingNote = meetingNote;
    }

    public PickupStatus getStatus() {
        return status;
    }

    public void setStatus(PickupStatus status) {
        this.status = status;
    }

    public Instant getTimeCreated() {
        return timeCreated;
    }

    public void setTimeCreated(Instant timeCreated) {
        this.timeCreated = timeCreated;
    }

    public Instant getTimeResponded() {
        return timeResponded;
    }

    public void setTimeResponded(Instant timeResponded) {
        this.timeResponded = timeResponded;
    }
}
