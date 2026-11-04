# Notifications and offer negotiations

The frontend reads the authenticated notification inbox from
`GET /api/v1/me/notifications` and its unread total from
`GET /api/v1/me/notifications/unread-count`. Marking a notice read uses
`PATCH /api/v1/me/notifications/{id}/read`. Inbox paging is newest-first; the
client deduplicates overlapping page records by notification ID.

The notification bell subscribes to the authenticated
`/user/queue/notifications` STOMP destination. A connection or reconnection
triggers a REST inbox/count refresh because WebSocket delivery is not durable.
Live events are deduplicated by event/notification ID. The notification badge
is separate from conversation message unread counts.

Native browser notifications are opt-in: the browser permission prompt is
requested only after the user activates **Enable desktop alerts**. If the
browser does not support notifications or permission is denied, live events
appear as in-app notices and remain available in the inbox. Clicking an offer
notification opens `/offers/{offerId}`, which refetches the participant-
authorized current offer instead of trusting the older event payload.
Acceptance language describes agreement only; it does not claim payment,
reservation, pickup, or sale.

Offer reads use `GET /api/v1/offers/{offerId}`. Counter and decision requests
include the displayed `expectedVersion` and send their retry-safe idempotency
key in the `Idempotency-Key` header. On a stale-version conflict the screen
refetches the offer before allowing another response.

This sprint supports native notifications only while DormDrop is open.
Closed-site delivery, Web Push subscriptions, and service workers are
intentionally out of scope.
