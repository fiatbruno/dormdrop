package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.dto.ModerationDtos;
import edu.augustana.csc305.project.dto.SubmitReportRequest;
import edu.augustana.csc305.project.service.ReportSubmissionService;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
public class ReportController {
    private final ReportSubmissionService reports;
    public ReportController(ReportSubmissionService reports) { this.reports = reports; }

    @PostMapping("/home/{listingId}/reports")
    public ResponseEntity<ModerationDtos.ReporterStatus> submit(@PathVariable String listingId,
            @Valid @RequestBody SubmitReportRequest request,
            @RequestHeader("Idempotency-Key") String key, Authentication auth) {
        var result = reports.submit(listingId, request, key, auth);
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK)
                .cacheControl(CacheControl.noStore()).body(result.status());
    }

    @GetMapping("/me/reports")
    public ResponseEntity<List<ModerationDtos.ReporterStatus>> own(Authentication auth,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(reports.ownReports(auth, page, size));
    }

    @ExceptionHandler(ReportSubmissionService.RateLimitExceeded.class)
    public ResponseEntity<Map<String, String>> limited(ReportSubmissionService.RateLimitExceeded exception) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, Long.toString(exception.retryAfter()))
                .cacheControl(CacheControl.noStore()).body(Map.of("message", exception.getReason()));
    }
}
