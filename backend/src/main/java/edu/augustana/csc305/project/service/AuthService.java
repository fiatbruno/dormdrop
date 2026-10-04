package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.dto.SignUpRequest;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.UserRepository;
import org.bson.types.ObjectId;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Optional;

@Service
public class AuthService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, EmailService emailService){
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
    }

    public User signUp(SignUpRequest newRequest){
        String name = newRequest.getName().trim();
        String email = newRequest.getEmail().trim().toLowerCase();
        String password = newRequest.getPassword();

        if(name.isEmpty()){
            throw new IllegalArgumentException("Name field cannot be empty");
        }
        if(!email.endsWith("@augustana.edu")){
            throw new IllegalArgumentException("Invalid email. Please use an Augustana college email address.");
        }
        if(userRepository.emailExists(email)){
            throw new IllegalArgumentException("This email is already associated with an account!");

        }
        String passwordHash = passwordEncoder.encode(password);
        ObjectId id = new ObjectId();
        User user = new User(id, name, email, passwordHash);

        String verificationToken = generateVerificationToken();
        user.setVerificationToken(verificationToken);

        long timeToExpire = System.currentTimeMillis() + (24L * 60 * 60 * 1000);
        user.setVerificationToken(String.valueOf(timeToExpire));
        userRepository.storeUser(user);
        emailService.sendVerificationEmail(email, verificationToken);
        return user;
    }

    private String generateVerificationToken(){
        SecureRandom randomKey = new SecureRandom();
        byte[] bytes = new byte[32];
        randomKey.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public void verifyEmail(String token){
        Optional<User> unverifiedUser = userRepository.findByVerificationToken(token);

        if(unverifiedUser.isEmpty()){
            throw new IllegalArgumentException("Invalid link for verification!");
        }
        User user = unverifiedUser.get();

        if(System.currentTimeMillis() > user.getVerificationTokenExpiration()){
            throw new IllegalArgumentException("The time to use this verification link has passed!");
        }

        userRepository.updateUserVerification(user.getId().toHexString(), true);
    }
}
