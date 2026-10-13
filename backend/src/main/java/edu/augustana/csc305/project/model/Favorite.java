
package edu.augustana.csc305.project.model;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "favorites")
@CompoundIndex(
        name = "unique_user_listing",
        def = "{'userId': 1, 'listingId': 1}",
        unique = true
)
public class Favorite {

    @Id
    private ObjectId id;

    private ObjectId userId;
    private ObjectId listingId;

    public Favorite() {}

    public Favorite(ObjectId userId, ObjectId listingId) {
        this.userId = userId;
        this.listingId = listingId;
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
}
