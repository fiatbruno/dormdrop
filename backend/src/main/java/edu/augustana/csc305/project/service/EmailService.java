package edu.augustana.csc305.project.service;

import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import edu.augustana.csc305.project.config.PublicUrls;
import org.springframework.stereotype.Service;

@Service
public class EmailService {
    private final JavaMailSender mailSender;
    private final PublicUrls urls;

    public EmailService(JavaMailSender mailSender, PublicUrls urls){
        this.mailSender = mailSender;
        this.urls = urls;
    }

    public void sendVerificationEmail(String email, String token){
       // System.out.println("Sending email");
        String verificationLink = urls.verification(token).toString();

        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(email);
        message.setSubject("Verify your Augustana email to finish setting up DormDrop.");
        message.setText("Welcome to DormDrop!\n\n" + "Verify your Augie email " + "by clicking the link below::\n\n" + verificationLink + "\n\n" + "This verification link expires after 5 minutes.");
        mailSender.send(message);
    }

    public void sendPasswordResetEmail(String email, String token){
        String resetLink = urls.passwordReset(token).toString();

        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(email);
        message.setSubject("Please Reset your DormDrop password");
        message.setText("A request to reset your password was received.\n\n" +
                 "Use the link below to choose your new password: \n\n" +
                resetLink + "\n\n"
        +"This link expires in 5 minutes and can only be used once.\n\n"
        +"If you did not request this reset, ignore this email.");

        mailSender.send(message);
    }

}
