package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.dto.AdminDirectoryDtos;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.model.UserRole;
import edu.augustana.csc305.project.security.PermissionPolicy;
import edu.augustana.csc305.project.security.StaffAccess;
import java.time.Instant;
import java.util.List;
import java.util.regex.Pattern;
import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminDirectoryService {
    private final MongoTemplate mongo;
    private final StaffAccess access;

    public AdminDirectoryService(MongoTemplate mongo, StaffAccess access) {
        this.mongo = mongo;
        this.access = access;
    }

    // Mapping a projection avoids loading password hashes and tokens into directory results.
    public record DirectoryUser(@Id ObjectId id, String name, String email, boolean emailVerified,
                                UserRole role, Instant createdAt, Instant updatedAt) { }

    public AdminDirectoryDtos.Page list(Authentication auth, String search, int page, int size) {
        access.require(auth, PermissionPolicy.Capability.VIEW_MEMBER_DIRECTORY);
        if (page < 0 || size < 1 || size > 100) {
            throw badRequest("Page must be nonnegative; size must be between 1 and 100.");
        }
        if (search != null && (search.length() > 100 || search.codePoints().anyMatch(Character::isISOControl))) {
            throw badRequest("Search must be at most 100 characters and contain no control characters.");
        }
        String term = search == null ? "" : search.trim();
        Criteria criteria = new Criteria();
        if (!term.isEmpty()) {
            Pattern literal = Pattern.compile(Pattern.quote(term), Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
            criteria = new Criteria().orOperator(Criteria.where("name").regex(literal), Criteria.where("email").regex(literal));
        }
        long total = mongo.count(Query.query(criteria), User.class);
        Query query = Query.query(criteria).with(Sort.by(Sort.Order.asc("name"), Sort.Order.asc("_id")))
                .skip((long) page * size).limit(size);
        query.fields().include("name").include("email").include("emailVerified").include("role")
                .include("createdAt").include("updatedAt");
        List<AdminDirectoryDtos.Member> items = mongo.find(query, DirectoryUser.class, "users").stream()
                .map(user -> new AdminDirectoryDtos.Member(user.id().toHexString(), user.name(), maskEmail(user.email()),
                        user.emailVerified(), user.role() == null ? UserRole.STUDENT : user.role(),
                        user.createdAt(), user.updatedAt()))
                .toList();
        return new AdminDirectoryDtos.Page(items, total, page, size, total == 0 ? 0 : (total - 1) / size + 1);
    }

    private static String maskEmail(String email) {
        if (email == null) return null;
        int at = email.indexOf('@');
        if (at <= 0 || at != email.lastIndexOf('@') || at == email.length() - 1) return null;
        return "***" + email.substring(at);
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
