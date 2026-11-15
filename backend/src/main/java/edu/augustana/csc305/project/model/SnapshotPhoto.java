package edu.augustana.csc305.project.model;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/** Private evidence copy, independent of the seller's original upload. */
@Document(collection = "snapshotPhotos")
public record SnapshotPhoto(
        @Id String id,
        ObjectId snapshotId,
        ObjectId caseId,
        String key,
        String contentType,
        byte[] bytes
) {
    public SnapshotPhoto { bytes = bytes.clone(); }

    @Override
    public byte[] bytes() { return bytes.clone(); }

    public static String idFor(ObjectId snapshotId, String key) {
        return snapshotId.toHexString() + ":" + key;
    }
}
