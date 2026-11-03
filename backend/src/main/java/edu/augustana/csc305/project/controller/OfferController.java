package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.dto.OfferDtos;
import edu.augustana.csc305.project.service.OfferService;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
public class OfferController {
    private final OfferService offers;
    public OfferController(OfferService offers) { this.offers = offers; }

    @PostMapping("/home/{listingId}/offers")
    public ResponseEntity<OfferDtos.Offer> submit(Authentication auth, @PathVariable String listingId,
            @RequestHeader("Idempotency-Key") String key, @RequestBody OfferDtos.Submit request) {
        var result = offers.submit(auth, listingId, request == null ? null : request.amount(), key);
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK)
                .cacheControl(CacheControl.noStore()).body(OfferDtos.from(result.offer()));
    }

    @GetMapping("/offers/{offerId}")
    public ResponseEntity<OfferDtos.Offer> get(Authentication auth, @PathVariable String offerId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(OfferDtos.from(offers.get(auth, offerId)));
    }

    @GetMapping("/me/offers")
    public ResponseEntity<OfferDtos.Page> list(Authentication auth, @RequestParam String perspective,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        var result = offers.list(auth, perspective, page, size);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new OfferDtos.Page(
                result.items().stream().map(OfferDtos::from).toList(), result.total(), result.page(), result.size()));
    }
}
