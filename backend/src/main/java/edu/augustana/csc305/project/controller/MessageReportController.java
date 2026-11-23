package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.dto.MessageReportDtos;
import edu.augustana.csc305.project.dto.MessageReportActionDtos;
import edu.augustana.csc305.project.dto.SubmitMessageReportRequest;
import edu.augustana.csc305.project.service.MessageReportService;
import edu.augustana.csc305.project.service.MessageReportReviewService;
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
    private final MessageReportReviewService review;

    public MessageReportController(MessageReportService reports, MessageReportReviewService review) {
        this.reports = reports;
        this.review = review;
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

    @GetMapping("/conversations/{conversationId}/message-reports/mine")
    public ResponseEntity<List<String>> mine(
            @PathVariable String conversationId,
            Authentication authentication
    ) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(reports.myReportedMessageIds(conversationId, authentication));
    }

    @GetMapping("/admin/message-reports")
    public ResponseEntity<List<MessageReportActionDtos.Report>> adminQueue() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(review.queue());
    }

    @PostMapping("/admin/message-reports/{reportId}/notes")
    public MessageReportActionDtos.Receipt addNote(
            @PathVariable String reportId,
            @Valid @RequestBody MessageReportActionDtos.NoteRequest request,
            Authentication authentication
    ) {
        return review.addNote(reportId, request, authentication);
    }

    @PostMapping("/admin/message-reports/{reportId}/dismiss")
    public MessageReportActionDtos.Receipt dismiss(
            @PathVariable String reportId,
            @Valid @RequestBody MessageReportActionDtos.DismissRequest request,
            Authentication authentication
    ) {
        return review.dismiss(reportId, request, authentication);
    }

    @PostMapping("/admin/message-reports/{reportId}/warnings")
    public MessageReportActionDtos.Receipt warn(
            @PathVariable String reportId,
            @Valid @RequestBody MessageReportActionDtos.WarningRequest request,
            Authentication authentication
    ) {
        return review.warn(reportId, request, authentication);
    }

    @PostMapping("/admin/message-reports/{reportId}/suspensions")
    public MessageReportActionDtos.Receipt suspend(
            @PathVariable String reportId,
            @Valid @RequestBody MessageReportActionDtos.SuspensionRequest request,
            Authentication authentication
    ) {
        return review.suspend(reportId, request, authentication);
    }
}
