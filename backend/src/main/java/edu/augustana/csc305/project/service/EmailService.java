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
        message.setText("Welcome to DormDrop!\n\n" + "Verify your Augie email " + "by clicking the link below::\n\n" + verificationLink + "\n\n" + "This verification link expires after 24 hours.");
        mailSender.send(message);
    }

}
