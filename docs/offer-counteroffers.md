# Counteroffers

An authenticated, verified participant can respond to the other person's
current proposal with `POST /api/v1/offers/{offerId}/counteroffers`:

```http
POST /api/v1/offers/64b000000000000000000001/counteroffers
Authorization: Bearer <token>
Idempotency-Key: unique-counter-request-key
Content-Type: application/json

{ "amount": 25.00, "expectedVersion": 0 }
```

`amount` must be positive and have at most two decimal places. The
`expectedVersion` is the version returned with the current offer. A successful
response returns the updated offer, its new version, and the complete proposal
history. Buyer and seller can take turns countering until one accepts or rejects
the latest proposal.

Reusing the same key for an identical request returns the original response.
Reusing it with different details, or responding to a stale or ended offer,
returns 409. The current proposer and unrelated users cannot respond. A new
counter requires the listing to remain an available, visible sale.

The counter and retry record are saved together in a MongoDB transaction, so
MongoDB must run as a replica set or Atlas cluster. To run the database tests,
set `MODERATION_TEST_MONGODB_URI` to a disposable transaction-capable test
server and run `mvn test` from `backend/`.
