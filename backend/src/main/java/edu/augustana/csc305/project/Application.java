package edu.augustana.csc305.project;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * The main entry point for the Spring Boot application.
 *
 * You should run this with MONGODB_URI and JWT_SECRET environment variables
 * set (see the README). If you are running from IntelliJ, you can give your
 * run configuration a .env file with these variables set.
 */
@SpringBootApplication
public class Application {

	public static void main(String[] args) {
		SpringApplication.run(Application.class, args);
	}
}
