package edu.augustana.csc305.project.repository;

import edu.augustana.csc305.project.model.MessageReportAction;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface MessageReportActionRepository extends MongoRepository<MessageReportAction, ObjectId> {
    List<MessageReportAction> findByReportIdAndTypeOrderByCreatedAtAsc(
            ObjectId reportId,
            MessageReportAction.Type type
    );
}
