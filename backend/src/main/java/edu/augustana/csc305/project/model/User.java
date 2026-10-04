package edu.augustana.csc305.project.model;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * User object as stored in the database.
 */
@Document(collection = "users")
public class User {
    @Id private ObjectId id;
    private String name;
    private String email;  // Unique: see the index created in UserRepository.
    private String passwordHash;
    private boolean emailVerified;
    private String verificationToken;
    public long verificationTokenExpiration;

    public User() { }

    public User(ObjectId id, String name, String email, String passwordHash) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.passwordHash = passwordHash;
        this.emailVerified = false;
        this.verificationToken = null;
        this.verificationTokenExpiration = 0;
    }

    public ObjectId getId() { return id; }
    public void setId(ObjectId id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public boolean isEmailVerified() {
        return emailVerified;
    }

    public void setEmailVerified(boolean emailVerified){
        this.emailVerified = emailVerified;
    }

    public String getVerificationToken(){
        return verificationToken;
    }

    public void setVerificationToken(String verificationToken){
        this.verificationToken = verificationToken;
    }

    public long getVerificationTokenExpiration(){
        return verificationTokenExpiration;
    }

    public void setVerificationTokenExpiration(long verificationTokenExpiration){
        this.verificationTokenExpiration = verificationTokenExpiration;
    }
}
