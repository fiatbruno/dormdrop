package edu.augustana.csc305.project.repository;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.IndexOptions;
import com.mongodb.client.model.Indexes;
import edu.augustana.csc305.project.model.User;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/** Interacts with the "users" collection in the backing database. */
@Repository public class UserRepository {

    MongoCollection<User> users;

    public UserRepository(MongoDatabaseFactory mdbFactory) {
        MongoDatabase mongoDb = mdbFactory.getMongoDatabase();
        users = mongoDb.getCollection("users", User.class);

        // Make sure no two users can have the same email address. (This does
        // nothing if the index already exists.)
        users.createIndex(Indexes.ascending("email"), new IndexOptions().unique(true));
    }

    public long count() {
        return users.countDocuments();
    }

    public void storeUser(User user) {
        users.insertOne(user);
    }

    public Optional<User> findByEmail(String email) {
        for (User user : users.find(Filters.eq("email", email))) {
            return Optional.of(user);
        }
        return Optional.empty();
    }

}
