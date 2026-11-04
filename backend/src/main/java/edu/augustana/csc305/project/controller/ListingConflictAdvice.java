package edu.augustana.csc305.project.controller;

import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestControllerAdvice
public class ListingConflictAdvice {
    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ResponseEntity<Map<String, String>> conflict() {
        return ResponseEntity.status(HttpStatus.CONFLICT).cacheControl(CacheControl.noStore()).body(Map.of(
                "code", "LISTING_CHANGED",
                "message", "This listing changed while you were editing. Your changes were not saved. Refresh the listing and try again."));
    }
}
