package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.model.RoleChange;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.model.UserRole;
import edu.augustana.csc305.project.security.PermissionPolicy;
import edu.augustana.csc305.project.security.StaffAccess;
import edu.augustana.csc305.project.security.WebSocketSessions;
import java.time.Instant;
import java.util.Locale;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DataAccessException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.TransactionException;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TeamRoleService {
    private final MongoTemplate mongo;
    private final TransactionOperations transactions;
    private final StaffAccess access;
    private final WebSocketSessions sockets;

    public TeamRoleService(MongoTemplate mongo, @Qualifier("reportTransactions") TransactionOperations transactions,
                           StaffAccess access, WebSocketSessions sockets) {
        this.mongo = mongo;
        this.transactions = transactions;
        this.access = access;
        this.sockets = sockets;
    }

    public UserRole changeRole(Authentication auth, String targetId, UserRole requested) {
        access.require(auth, PermissionPolicy.Capability.MANAGE_ROLES);
        if (requested == null || !ObjectId.isValid(targetId))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Valid user ID and role required.");
        ObjectId id = new ObjectId(targetId);
        try {
            Boolean changed = transactions.execute(status -> {
                // All role mutations contend on one persistent document. Snapshot isolation alone
                // permits write skew when two administrators demote each other.
                mongo.upsert(Query.query(Criteria.where("_id").is("roles")),
                        new Update().inc("revision", 1), "role_change_guard");
                User actor = access.require(auth, PermissionPolicy.Capability.MANAGE_ROLES);
                User target = mongo.findById(id, User.class);
                if (target == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found.");
                if (!target.isEmailVerified() || target.getEmail() == null ||
                        !target.getEmail().trim().toLowerCase(Locale.ROOT).endsWith("@augustana.edu"))
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A verified campus account is required.");
                UserRole prior = target.getRole();
                if (prior == requested) return false;
                if (prior == UserRole.ADMIN && requested != UserRole.ADMIN &&
                        mongo.count(Query.query(Criteria.where("role").is(UserRole.ADMIN)), User.class) <= 1)
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "The final administrator cannot be demoted.");
                mongo.updateFirst(Query.query(Criteria.where("_id").is(id)),
                        new Update().set("role", requested).inc("roleVersion", 1), User.class);
                mongo.insert(new RoleChange(new ObjectId(), actor.getId(), id, prior, requested, Instant.now()));
                return true;
            });
            if (Boolean.TRUE.equals(changed)) sockets.disconnectUser(id);
            return requested;
        } catch (DataAccessException | TransactionException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Role change could not be committed; retry.", ex);
        }
    }
}
