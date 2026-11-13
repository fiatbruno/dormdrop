package edu.augustana.csc305.project.repository;

import edu.augustana.csc305.project.model.MessageReport;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface MessageReportRepository extends MongoRepository<MessageReport, ObjectId> {
    java.util.List<MessageReport> findAllByOrderByCreatedAtDesc();
}
