package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.security.WebSocketSessions;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AccountDeletionService {
    private final MongoTemplate mongo;
    private final TransactionOperations transactions;
    private final WebSocketSessions sockets;

    public AccountDeletionService(MongoTemplate mongo,
                                  @Qualifier("reportTransactions") TransactionOperations transactions,
                                  WebSocketSessions sockets) {
        this.mongo = mongo;
        this.transactions = transactions;
        this.sockets = sockets;
    }

    public void delete(String email) {
        ObjectId deleted = transactions.execute(status -> {
            User user = mongo.findOne(Query.query(Criteria.where("email").is(email)), User.class);
            if (user == null) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account not found.");
            }
            if (user.getRole() == UserRole.ADMIN) {
                // Serialize with administrator role changes so the app always has an admin.
                mongo.upsert(Query.query(Criteria.where("_id").is("roles")),
                        new Update().inc("revision", 1), "role_change_guard");
                if (mongo.count(Query.query(Criteria.where("role").is(UserRole.ADMIN)), User.class) <= 1) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Assign another administrator before deleting this account.");
                }
            }
            ObjectId id = user.getId();
            mongo.remove(Query.query(Criteria.where("ownerId").is(id)), Listing.class);
            Query owned = Query.query(Criteria.where("userId").is(id));
            mongo.remove(owned, Favorite.class);
            mongo.remove(owned, SavedListing.class);
            mongo.remove(Query.query(Criteria.where("recipientId").is(id)), PrivateNotification.class);
            mongo.remove(Query.query(Criteria.where("_id").is(id)), User.class);
            return id;
        });
        sockets.disconnectUser(deleted);
    }
}
