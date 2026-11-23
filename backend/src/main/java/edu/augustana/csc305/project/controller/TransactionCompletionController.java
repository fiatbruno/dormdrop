
package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.dto.CompletedTransactionResponse;
import edu.augustana.csc305.project.model.CompletedTransaction;
import edu.augustana.csc305.project.service.TransactionCompletionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

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

    public record ReviewRequest(@NotNull @Min(1) @Max(5) Integer rating, @Size(max = 500) String comment) {}

    @PostMapping("/review")
    public ResponseEntity<CompletedTransactionResponse> submitReview(
            @PathVariable String offerId, @Valid @RequestBody ReviewRequest request, Authentication authentication
    ) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(CompletedTransactionResponse.from(
                service.submitReview(offerId, authentication, request.rating(), request.comment())));
    }

    @GetMapping("/seller-reviews")
    public ResponseEntity<List<CompletedTransaction.SellerReview>> getSellerReviews(
            @PathVariable String offerId, Authentication authentication
    ) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.getSellerReviews(offerId, authentication));
    }
}
