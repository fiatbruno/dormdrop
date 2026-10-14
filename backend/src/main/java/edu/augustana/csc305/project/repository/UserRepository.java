
package edu.augustana.csc305.project.repository;

import edu.augustana.csc305.project.model.User;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public class UserRepository {

    private final MongoTemplate mongoTemplate;

    public UserRepository(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    public long count() {
        return mongoTemplate.count(new Query(), User.class);
    }

    public void storeUser(User user) {
        mongoTemplate.insert(user);
    }

    public Optional<User> findByEmail(String email) {
        User user = mongoTemplate.findOne(
                Query.query(Criteria.where("email").is(email)),
                User.class
        );
        return Optional.ofNullable(user);
    }

    public boolean emailExists(String email) {
        return mongoTemplate.exists(
                Query.query(Criteria.where("email").is(email)),
                User.class
        );
    }

    public Optional<User> findByVerificationToken(String token) {
        User user = mongoTemplate.findOne(
                Query.query(
                        Criteria.where("verificationToken").is(token)
                ),
                User.class
        );
        return Optional.ofNullable(user);
    }

    public void updateUserVerification(
            String userId,
            boolean emailVerified) {

        Query query = Query.query(
                Criteria.where("_id").is(new ObjectId(userId))
        );

        Update update = new Update()
                .set("emailVerified", emailVerified)
                .unset("verificationToken")
                .unset("verificationTokenExpiration");

        mongoTemplate.updateFirst(query, update, User.class);
    }

    public void updateVerificationToken(
            ObjectId userId,
            String newToken,
            long expiration) {

        Query query = Query.query(
                Criteria.where("_id").is(userId)
        );

        Update update = new Update()
                .set("verificationToken", newToken)
                .set("verificationTokenExpiration", expiration);

        mongoTemplate.updateFirst(query, update, User.class);
    }
}
