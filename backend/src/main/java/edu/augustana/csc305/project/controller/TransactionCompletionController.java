
package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.dto.CompletedTransactionResponse;
import edu.augustana.csc305.project.service.TransactionCompletionService;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/offers/{offerId}/transaction")
public class TransactionCompletionController {

    private final TransactionCompletionService service;

    public TransactionCompletionController(
            TransactionCompletionService service
    ) {
        this.service = service;
    }

    @PostMapping("/confirm-receipt")
    public ResponseEntity<CompletedTransactionResponse> confirmReceipt(
            @PathVariable String offerId,
            Authentication authentication
    ) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(CompletedTransactionResponse.from(
                        service.confirmReceipt(
                                offerId,
                                authentication
                        )
                ));
    }

    @GetMapping
    public ResponseEntity<CompletedTransactionResponse> getTransaction(
            @PathVariable String offerId,
            Authentication authentication
    ) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(CompletedTransactionResponse.from(
                        service.getCompletedTransaction(
                                offerId,
                                authentication
                        )
                ));
    }
}
