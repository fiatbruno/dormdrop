
package edu.augustana.csc305.project.model;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Document(collection = "listings")
public class Listing {

    @Id
    private ObjectId id;

    private String title;

    private String description;

    private String category;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal price;

    private String condition;

    private String pickupArea;

    private String imageUrl;

    @CreatedDate
    private LocalDateTime listedOn;

    private ListingStatus status = ListingStatus.AVAILABLE;

    private ObjectId ownerId;

    public Listing() {
    }

    public ObjectId getId() {
        return id;
    }

    public void setId(ObjectId id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public String getCondition() {
        return condition;
    }

    public void setCondition(String condition) {
        this.condition = condition;
    }

    public String getPickupArea() {
        return pickupArea;
    }

    public void setPickupArea(String pickupArea) {
        this.pickupArea = pickupArea;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public LocalDateTime getListedOn() {
        return listedOn;
    }

    public void setListedOn(LocalDateTime listedOn) {
        this.listedOn = listedOn;
    }

    public ListingStatus getStatus() {
        return status;
    }

    public void setStatus(ListingStatus status) {
        this.status = status;
    }

    public ObjectId getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(ObjectId ownerId) {
        this.ownerId = ownerId;
    }
}
