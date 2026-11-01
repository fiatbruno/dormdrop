# Issue #64: private listing evidence

Depends on #59. Its schema sources are included on this branch to compile before
that PR merges. Reconcile them with main after #59 merges; do not drop its changes.

## Report submission integration

Call `ListingEvidenceService.retainAndInsertReport(report, expectedListingVersion)`
from the authenticated report submission workflow. That workflow must derive the
reporter from the authenticated user, select the active case, validate reporting
rules, and reuse the same server-issued report ID for an idempotent request.
Set `report.snapshotId` equal to `report.id`. Do not directly insert reports or
construct snapshots from frontend-supplied listing text or URLs.

This issue adds the retention integration service, not a new report submission
HTTP endpoint. Reporter uploads are deferred.

The service captures listing version, seller ID, text, category, price, lifecycle,
and image bytes. It checks listing version before and after reading the source.
Missing or unreadable images fail retention; they are never silently omitted.
A listing with no image produces a valid text-only snapshot.

Metadata and up to 5 MB of image bytes are inserted together in one immutable
`listingSnapshots` document, then the report is inserted. This avoids partially
uploaded media and filesystem leftovers. Only local validated upload paths are
read; no external URLs are fetched. Retained bytes are never stored in `uploads`
or served by `/images`.

If report insertion fails after snapshot insertion, the snapshot remains for a
retry with the same ID. Retry reuses it even after the seller deletes the listing.
There are no duplicate media files. An abandoned request can leave one private
orphan snapshot; do not delete evidence on listing edits or deletion. A future
orphan cleanup policy must account for pending retries and ambiguous write results.
Report acceptance is not atomic with concurrent case resolution; report submission
must handle that separately as part of its case/report transaction workflow.

## Staff access

The current persisted `ADMIN` role represents moderation staff. Both endpoints
recheck that role and verify case/snapshot association:

- `GET /api/v1/staff/cases/{caseId}/snapshots/{snapshotId}`
- `GET /api/v1/staff/cases/{caseId}/snapshots/{snapshotId}/media/image`

Use a bearer token. Snapshot responses contain metadata and media keys, not image
bytes or public storage paths. Responses use `Cache-Control: no-store`; media also
uses `X-Content-Type-Options: nosniff`. Ordinary users, including the seller, get
403. Missing authentication gets 401. A mismatched case or missing image gets 404.
No new environment variables or filesystem directories are required. MongoDB
backups must include the private `listingSnapshots` collection.

## Validation

Run `./mvnw.cmd test` from the backend directory. Evidence tests use temporary
local upload files and mocked database operations; they cover retained evidence
after edits/replacement/deletion, failure ordering, retry reuse, version conflicts,
staff authorization, case scoping, URL/path rejection, and defensive byte copies.
They do not require a live MongoDB connection. A live MongoDB round-trip test is
available with `MODERATION_TEST_MONGODB_URI` set (see `ListingEvidenceMongoTest`).

```powershell
$env:MODERATION_TEST_MONGODB_URI = 'YOUR_TEST_MONGODB_CONNECTION_STRING'
.\mvnw.cmd test '-Dtest=ListingEvidenceTest,ListingEvidenceMongoTest'
Remove-Item Env:MODERATION_TEST_MONGODB_URI
```

Do not commit credentials. The integration test uses an isolated `evidence_test_`
database under Atlas's name limit and deletes its test records afterward; empty
collections/indexes may remain because cleanup does not require drop privileges.
