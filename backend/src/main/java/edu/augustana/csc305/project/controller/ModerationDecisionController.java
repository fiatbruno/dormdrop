package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.dto.ModerationDecisionDtos.*;
import edu.augustana.csc305.project.service.ModerationDecisionService;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
public class ModerationDecisionController {
    private final ModerationDecisionService commands;
    public ModerationDecisionController(ModerationDecisionService commands) { this.commands = commands; }
    @PostMapping("/admin/reports/{caseId}/decisions")
    public ResponseEntity<Result> caseDecision(@PathVariable String caseId, @Valid @RequestBody Request body,
            @RequestHeader("Idempotency-Key") String key, Authentication auth) {
        return respond(commands.decide(ModerationDecisionService.Target.CASE,caseId,body,key,auth));
    }
    @PostMapping("/admin/listings/{listingId}/decisions")
    public ResponseEntity<Result> listingDecision(@PathVariable String listingId, @Valid @RequestBody Request body,
            @RequestHeader("Idempotency-Key") String key, Authentication auth) {
        return respond(commands.decide(ModerationDecisionService.Target.LISTING,listingId,body,key,auth));
    }
    private ResponseEntity<Result> respond(ModerationDecisionService.Outcome result) {
        return ResponseEntity.status(result.created()?HttpStatus.CREATED:HttpStatus.OK)
                .cacheControl(CacheControl.noStore()).body(result.result());
    }
}
