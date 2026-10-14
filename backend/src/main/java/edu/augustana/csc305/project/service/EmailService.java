package edu.augustana.csc305.project.service;

import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {
    private final JavaMailSender mailSender;

    public EmailService(JavaMailSender mailSender){
        this.mailSender = mailSender;
    }

    public void sendVerificationEmail(String email, String token){
       // System.out.println("Sending email");
        String verificationLink = "http://localhost:8080/api/v1/auth/verify?token=" + token;

        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(email);
        message.setSubject("Verify your Augustana email to finish setting up DormDrop.");
        message.setText("Welcome to DormDrop!\n\n" + "Verify your Augie email " + "by clicking the link below::\n\n" + verificationLink + "\n\n" + "This verification link expires after 5 minutes.");
        mailSender.send(message);
    }

    public void sendPasswordResetEmail(String email, String token){
        String restLink = "http://localhost:5173/reset-password?token=" + token;

        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(email);
        message.setSubject("Please Reset your DormDrop password");
        message.setText("A request to reset your password was received.\n\n" +
                 "Use the link below to choose your new password: \n\n" +
                restLink + "\n\n"
        +"This link expires in 5 minutes and can only be used once.\n\n"
        +"If you did not request this reset, ignore this email.");

        mailSender.send(message);
    }

}
