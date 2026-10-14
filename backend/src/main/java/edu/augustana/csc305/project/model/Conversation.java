
package edu.augustana.csc305.project.model;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "conversations")
@CompoundIndex(
        name = "unique_listing_buyer",
        def = "{'listingId': 1, 'buyerId': 1}",
        unique = true
)
public class Conversation {

    @Id
    private ObjectId id;

    private ObjectId listingId;
    private ObjectId buyerId;
    private ObjectId sellerId;

    private Instant createdAt;
    private Instant lastMessageAt;

    public Conversation() {
    }

    public Conversation(
            ObjectId listingId,
            ObjectId buyerId,
            ObjectId sellerId
    ) {
        this.listingId = listingId;
        this.buyerId = buyerId;
        this.sellerId = sellerId;
        this.createdAt = Instant.now();
        this.lastMessageAt = this.createdAt;
    }

    public ObjectId getId() {
        return id;
    }

    public void setId(ObjectId id) {
        this.id = id;
    }

    public ObjectId getListingId() {
        return listingId;
    }

    public void setListingId(ObjectId listingId) {
        this.listingId = listingId;
    }

    public ObjectId getBuyerId() {
        return buyerId;
    }

    public void setBuyerId(ObjectId buyerId) {
        this.buyerId = buyerId;
    }

    public ObjectId getSellerId() {
        return sellerId;
    }

    public void setSellerId(ObjectId sellerId) {
        this.sellerId = sellerId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getLastMessageAt() {
        return lastMessageAt;
    }

    public void setLastMessageAt(Instant lastMessageAt) {
        this.lastMessageAt = lastMessageAt;
    }
}
