
package edu.augustana.csc305.project.model;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "saved_listings")
@CompoundIndex(
        name = "unique_user_listing",
        def = "{'userId': 1, 'listingId': 1}",
        unique = true
)
public class SavedListing {

    @Id
    private ObjectId id;

    private ObjectId userId;
    private ObjectId listingId;
    private Instant savedAt;

    public SavedListing() {}

    public SavedListing(ObjectId userId, ObjectId listingId) {
        this.userId = userId;
        this.listingId = listingId;
        this.savedAt = Instant.now();
    }

    public ObjectId getId() {
        return id;
    }

    public void setId(ObjectId id) {
        this.id = id;
    }

    public ObjectId getUserId() {
        return userId;
    }

    public void setUserId(ObjectId userId) {
        this.userId = userId;
    }

    public ObjectId getListingId() {
        return listingId;
    }

    public void setListingId(ObjectId listingId) {
        this.listingId = listingId;
    }

    public Instant getSavedAt() {
        return savedAt;
    }

    public void setSavedAt(Instant savedAt) {
        this.savedAt = savedAt;
    }
}
