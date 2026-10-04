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
        String verificationLink = "http://localhost:5173/api/auth/verify-email?token=" + token;

        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(email);
        message.setSubject("Verify your Augustana email");
        message.setText("Welcome to DormDrop!\n\n" + "Verify your Augie email " + "by clicking the link below::\n\n" + verificationLink + "\n\n" + "Kindly note that the password lasts for just 24 hours and expires after!");
        mailSender.send(message);
    }

}
