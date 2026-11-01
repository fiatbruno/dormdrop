package edu.augustana.csc305.project.controller;

import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestControllerAdvice
public class ListingConflictAdvice {
    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ResponseEntity<Map<String,String>> conflict() {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", "Listing changed. Refresh before retrying."));
    }
}
