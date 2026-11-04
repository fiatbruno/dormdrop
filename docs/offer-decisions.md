# Offer decisions

An authenticated, verified campus user can answer the other participant's current
proposal with `POST /api/v1/offers/{offerId}/decisions`. Send the current offer
`version` as `expectedVersion`, along with a unique `Idempotency-Key` header:

```http
POST /api/v1/offers/64b000000000000000000001/decisions
Authorization: Bearer <token>
Idempotency-Key: decision-unique-key
Content-Type: application/json

{ "action": "ACCEPT", "expectedVersion": 0 }
```

`action` is `ACCEPT` or `REJECT`. A successful response is the updated offer,
including its new version and proposal history. Repeating the exact request
with the same key returns the original response; using the key for a different
decision returns 409. Stale versions and already-ended offers also return 409.

Only the participant who did not make the current proposal may respond.
Acceptance requires the listing to remain available and visible, but records an
agreement without changing the listing's status or other offers. Rejection is
available even if the listing has since been hidden, sold, or deleted.

The decision and retry record are stored in one MongoDB transaction, so MongoDB
must run as a replica set or Atlas cluster. To run the database integration tests,
set `MODERATION_TEST_MONGODB_URI` to a disposable transaction-capable test server
and run `mvn test` from `backend/`.
