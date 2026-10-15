
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

<<<<<<< HEAD
=======
    public Optional<User> findById(ObjectId id) {
        return Optional.ofNullable(mongoTemplate.findById(id, User.class));
    }
>>>>>>> e6fda1118bc38ccbb4026e61442cd2899aeef69d

    public boolean emailExists(String email) {
        return mongoTemplate.exists(
                Query.query(Criteria.where("email").is(email)),
                User.class
        );
    }


    public Optional<User> findByVerificationToken(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }

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
            boolean emailVerified
    ) {
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
            long expiration
    ) {
        Query query = Query.query(
                Criteria.where("_id").is(userId)
        );

        Update update = new Update()
                .set("verificationToken", newToken)
                .set("verificationTokenExpiration", expiration);

        mongoTemplate.updateFirst(query, update, User.class);
    }


    public void savePasswordResetToken(
            ObjectId userId,
            String token,
            long expiration
    ) {
        Query query = Query.query(
                Criteria.where("_id").is(userId)
        );

        Update update = new Update()
                .set("passwordResetToken", token)
                .set("passwordResetTokenExpiration", expiration);

        mongoTemplate.updateFirst(query, update, User.class);
    }


    public Optional<User> findByPasswordResetToken(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }

        User user = mongoTemplate.findOne(
                Query.query(
                        Criteria.where("passwordResetToken").is(token)
                ),
                User.class
        );

        return Optional.ofNullable(user);
    }


    public boolean updatePasswordAndClearResetToken(
            ObjectId userId,
            String token,
            String passwordHash,
            long currentTime
    ) {
        Query query = Query.query(
                Criteria.where("_id").is(userId)
                        .and("passwordResetToken").is(token)
                        .and("passwordResetTokenExpiration")
                        .gt(currentTime)
        );

        Update update = new Update()
                .set("passwordHash", passwordHash)
                .unset("passwordResetToken")
                .unset("passwordResetTokenExpiration");

        return mongoTemplate.updateFirst(
                query, update, User.class
        ).getModifiedCount() > 0;
    }


    public boolean updateUserProfile(
            ObjectId userId,
            String name,
            String aboutYou
    ) {
        Query query = Query.query(
                Criteria.where("_id").is(userId)
        );

        Update update = new Update()
                .set("name", name)
                .set("aboutYou", aboutYou);

        return mongoTemplate.updateFirst(
                query,
                update,
                User.class
        ).getMatchedCount() > 0;
    }

}
