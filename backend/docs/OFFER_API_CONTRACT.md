# Offer negotiation API contract

These examples describe the offer submission and read endpoints for frontend and backend development. Decisions are planned in #66, counteroffers in #71, and offer notification emission in later issues. The existing notification response shape shown below is already used by the notification API; offer-related emission is separate work.

All paths have the existing `/api/v1` prefix. Requests require a bearer token. The server determines the acting account from that token: never submit a buyer or seller ID to choose an identity. Offer details and history are visible only to the buyer and seller. The response includes only participant identifiers and negotiation data, not raw user records, email addresses, password hashes, tokens, or private messages. Object IDs in the examples are fictitious.

## Model and rules

An offer represents one negotiation for a listing between a buyer and its seller. Amounts are positive USD decimal JSON numbers with at most two fractional digits; they must be stored exactly as decimal values, never floating point. Times are UTC ISO-8601 strings. Status is `PENDING`, `ACCEPTED`, `REJECTED`, or `EXPIRED`, and version starts at 0. A new proposal or decision is appended to history; previous entries are not replaced. The current proposer cannot answer their own proposal. A counter changes the current amount and proposer, increments the version, and remains `PENDING`. Accept or reject ends the negotiation.

Only one `PENDING` negotiation may exist per buyer/listing at a time. Acceptance records agreement only: it does not reserve the listing, mark it sold, transfer payment, or change any other negotiation.

## Submit and read (#60)

`POST /api/v1/home/{listingId}/offers`

```http
Authorization: Bearer <token>
Content-Type: application/json
Idempotency-Key: offer-submit-001

{"amount": 19.99}
```

The buyer must be a verified campus account, the listing must exist and be an available sale (not a donation/free listing), and the buyer must differ from the listing owner. The server derives the seller from the listing. A successful creation returns `201` and the participant-safe object shown below; a successful replay returns `200` with the same result.

The idempotency key identifies a logical command for an actor and action. Retry the same request with the same key; reusing the key with a different payload is a conflict. A different key cannot create a second pending negotiation for the same buyer and listing.

`GET /api/v1/offers/{offerId}` returns the same participant-safe offer representation. A nonparticipant receives `404` so the endpoint does not reveal whether an offer exists. `GET /api/v1/me/offers?perspective=buyer&page=0&size=20` returns a page of offers; `perspective=seller` selects the caller's seller-side negotiations. The page contains `items`, `total`, `page`, and `size`. Pages are bounded and ordered newest first with an ID tie-breaker for stable ordering. Neither endpoint exposes other users' negotiations.

Example response:

```json
{
  "id": "64b000000000000000000004",
  "listingId": "64b000000000000000000001",
  "buyerId": "64b000000000000000000002",
  "sellerId": "64b000000000000000000003",
  "currentProposerId": "64b000000000000000000002",
  "amount": 19.99,
  "status": "PENDING",
  "version": 0,
  "createdAt": "2026-11-02T18:00:00Z",
  "updatedAt": "2026-11-02T18:00:00Z",
  "history": [{"action":"PROPOSED", "actorId":"64b000000000000000000002", "amount":19.99, "createdAt":"2026-11-02T18:00:00Z"}]
}
```

History actions are `PROPOSED`, `COUNTERED`, `ACCEPTED`, and `REJECTED`. The buyer submits the initial `PROPOSED` entry. Each history entry includes the action, actor ID, the proposal amount associated with that action, and its UTC creation time.

The participant-only `GET /api/v1/offers/{offerId}` response also includes
`buyerDisplayName`, or `null` if the buyer's account is unavailable. Other
offer responses may return `null` for this field. No email or raw user record is exposed.

## Decisions and counters (planned)

`POST /api/v1/offers/{offerId}/decisions` accepts a JSON request body, an `Idempotency-Key`, and bearer authentication. `action` is `ACCEPT` or `REJECT`; `expectedVersion` must match the current version. For example, the request body can be `{"action":"ACCEPT","expectedVersion":0}`. The other participant may answer the current proposal, not the proposer. Accepting an unavailable or removed listing is prohibited; an existing proposal may still be rejected. On success, the response is the same offer representation with the new status, incremented version, and appended decision history.

`POST /api/v1/offers/{offerId}/counteroffers` accepts a JSON request body, an `Idempotency-Key`, and bearer authentication. A valid counter requires the responding participant, current expected version, an available listing, and a positive USD amount with at most two decimal places. For example, the request body can be `{"amount":22.00,"expectedVersion":0}`. On success, the response contains the new current proposer and price, incremented version, and an appended `COUNTERED` entry. Both decision and counter requests are retry-safe; reusing a key for different input or acting on a stale/terminal offer is a conflict. UI clients should refresh the current offer after a conflict.

## Errors

- `400`: malformed IDs, missing/invalid key, invalid amount, pagination, or request body.
- `401`: missing or invalid authentication.
- `403`: authenticated actor is prohibited from submitting or performing an action, such as a self-offer.
- `404`: listing or negotiation is unavailable/inaccessible, including attempts to read someone else's offer.
- `409`: duplicate pending negotiation, changed payload with a reused key, stale version, terminal negotiation, or another conflicting state.
- `503`: the transaction could not be confirmed; retry the same request with the same idempotency key.

For a `409`, clients must rely on the HTTP status rather than treating the response message as a stable error code.

## Notification response

The existing private `NotificationResponse` shape for an accepted offer gives the authenticated recipient the notification ID, type, offer and listing IDs, safe payload, creation time, and optional read time. The offer reference should be used to fetch current participant-authorized state; a notification alone does not mean payment or listing sale. Notification delivery and deduplication are not implemented by #57.

## Database requirement

Submitting an offer uses a MongoDB transaction, so the deployment must use a transaction-capable replica set or sharded cluster. This branch was tested against a local replica set; the deployment topology still needs to be verified. The transaction stores the offer and idempotency record together and fences concurrent listing changes.

## Offers in conversations and expiration

Submitting an offer creates the buyer and seller's conversation for that listing, or reuses the existing one. Each conversation response includes an `offer` object (or `null`). The server selects the active offer first; otherwise it returns the newest past offer. Only the conversation participants can access it. The offer has `expiresAt`, an ISO-8601 UTC timestamp.

Each proposal, including a counteroffer, expires 14 days after it is made. An expired pending offer is returned with status `EXPIRED`; decisions and counteroffers after the deadline return `409`. The buyer may then submit a new offer. Existing pending offers follow the same rule based on the last proposal time. Expiration is evaluated when reading or acting on an offer, and an expired database record is finalized when a replacement is submitted. Exact retries of previously successful commands retain their original response.

Offer history contains proposal timestamps, so the frontend can place the card within the message timeline if desired. The frontend should use `expiresAt` and handle `EXPIRED` rather than displaying a hard-coded 14 days. Existing offers without conversations are not automatically backfilled.
