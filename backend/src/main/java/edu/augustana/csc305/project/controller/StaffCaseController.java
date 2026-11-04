package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.dto.StaffCaseDtos.*;
import edu.augustana.csc305.project.model.ModerationTypes.*;
import edu.augustana.csc305.project.service.StaffCaseService;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/admin/reports")
public class StaffCaseController {
    private final StaffCaseService service;
    public StaffCaseController(StaffCaseService service) { this.service = service; }
    @GetMapping
    public ResponseEntity<QueuePage> queue(Authentication auth, @RequestParam(required=false) CaseStatus status,
            @RequestParam(required=false) Priority priority, @RequestParam(defaultValue="0") int page,
            @RequestParam(defaultValue="20") int size) {
        return safe(service.queue(auth, status, priority, page, size));
    }
    @GetMapping("/{caseId}")
    public ResponseEntity<CaseDetail> detail(Authentication auth, @PathVariable String caseId) {
        return safe(service.detail(auth, caseId));
    }
    @PatchMapping("/{caseId}/assignment")
    public ResponseEntity<CaseSummary> assign(Authentication auth, @PathVariable String caseId,
                                              @Valid @RequestBody Assignment request) {
        return safe(service.assign(auth, caseId, request));
    }
    private <T> ResponseEntity<T> safe(T value) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(value);
    }
}
