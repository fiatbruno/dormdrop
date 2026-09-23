package edu.augustana.csc305.project.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * A simple {@link RestController} that serves a health check endpoint.
 * The endpoint's job is to simply respond "OK" when called.
 */
@RestController
public class HealthCheckController {

    // Note: this project is configured to prefix all @RestController endpoints with api/v1...
    @GetMapping("/healthCheck")  // ... so this will be mapped to: /api/v1/healthCheck
    public String healthCheck() {
        return "OK";
    }
}
