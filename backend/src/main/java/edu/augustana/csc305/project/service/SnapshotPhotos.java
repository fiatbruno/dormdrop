package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.model.SnapshotPhoto;
import org.bson.types.ObjectId;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Store each photo separately to stay below MongoDB's per-document limit. */
final class SnapshotPhotos {
    private SnapshotPhotos() {}

    static List<String> retain(MongoTemplate mongo, ImageStorageService images,
                               ObjectId snapshotId, ObjectId caseId, List<String> urls) {
        List<String> keys = new ArrayList<>();
        for (String url : urls) {
            var retained = images.retain(url);
            String key = keys.isEmpty() ? "image" : "image-" + (keys.size() + 1);
            var photo = new SnapshotPhoto(SnapshotPhoto.idFor(snapshotId, key), snapshotId,
                    caseId, key, retained.contentType(), retained.bytes());
            try {
                mongo.insert(photo);
            } catch (DuplicateKeyException retry) {
                SnapshotPhoto saved = mongo.findById(photo.id(), SnapshotPhoto.class);
                // Retries can reuse evidence, but can never replace its bytes.
                if (saved == null || !caseId.equals(saved.caseId())
                        || !photo.contentType().equals(saved.contentType())
                        || !Arrays.equals(photo.bytes(), saved.bytes())) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Evidence changed. Refresh the listing before reporting.");
                }
            }
            keys.add(key);
        }
        // These copies become accessible only after the complete snapshot is saved.
        return List.copyOf(keys);
    }
}
