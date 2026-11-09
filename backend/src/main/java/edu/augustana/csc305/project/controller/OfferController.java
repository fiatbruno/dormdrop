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
        var detail = offers.getDetail(auth, offerId);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(OfferDtos.from(detail.offer(), detail.buyerDisplayName()));
    }

    @GetMapping("/home/{listingId}/my-offer")
    public ResponseEntity<OfferDtos.Offer> buyerListingOffer(Authentication auth, @PathVariable String listingId) {
        var offer = offers.getBuyerListingOffer(auth, listingId);
        return offer == null ? ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build()
                : ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(OfferDtos.from(offer));
    }

    @PostMapping("/offers/{offerId}/decisions")
    public ResponseEntity<OfferDtos.Offer> decide(Authentication auth, @PathVariable String offerId,
            @RequestHeader("Idempotency-Key") String key, @RequestBody OfferDtos.Decision request) {
        var result = offers.decide(auth, offerId, request == null ? null : request.action(),
                request == null ? null : request.expectedVersion(), key);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(OfferDtos.from(result));
    }

    @PostMapping("/offers/{offerId}/counteroffers")
    public ResponseEntity<OfferDtos.Offer> counter(Authentication auth, @PathVariable String offerId,
            @RequestHeader("Idempotency-Key") String key, @RequestBody OfferDtos.Counter request) {
        var result = offers.counter(auth, offerId, request == null ? null : request.amount(),
                request == null ? null : request.expectedVersion(), key);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(OfferDtos.from(result));
    }

    @GetMapping("/me/offers")
    public ResponseEntity<OfferDtos.Page> list(Authentication auth, @RequestParam String perspective,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        var result = offers.list(auth, perspective, page, size);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new OfferDtos.Page(
                result.items().stream().map(OfferDtos::from).toList(), result.total(), result.page(), result.size()));
    }
}
