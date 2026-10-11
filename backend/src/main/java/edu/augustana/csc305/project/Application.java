
package edu.augustana.csc305.project;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.mongodb.config.EnableMongoAuditing;

/**
 * The main entry point for the Spring Boot application.
 *
 * Run with MONGODB_URI and JWT_SECRET environment variables set.
 */
@SpringBootApplication
@EnableMongoAuditing
public class Application {

	public static void main(String[] args) {
		SpringApplication.run(Application.class, args);
	}
}
