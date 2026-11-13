package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.dto.MessageReportDtos;
import edu.augustana.csc305.project.dto.SubmitMessageReportRequest;
import edu.augustana.csc305.project.service.MessageReportService;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class MessageReportController {
    private final MessageReportService reports;

    public MessageReportController(MessageReportService reports) {
        this.reports = reports;
    }

    @PostMapping("/conversations/{conversationId}/messages/{messageId}/reports")
    public ResponseEntity<MessageReportDtos.Receipt> submit(
            @PathVariable String conversationId,
            @PathVariable String messageId,
            @Valid @RequestBody SubmitMessageReportRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .cacheControl(CacheControl.noStore())
                .body(reports.submit(conversationId, messageId, request, authentication));
    }

    @GetMapping("/admin/message-reports")
    public ResponseEntity<List<MessageReportDtos.Report>> adminQueue() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(reports.adminQueue());
    }
}
