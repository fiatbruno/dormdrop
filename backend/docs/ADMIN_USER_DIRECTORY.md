# Administrator user directory

`GET /api/v1/admin/users?search=alex&page=0&size=20` requires a signed-in ADMIN account. The existing `/api/v1/users/me` response supplies the current role and capabilities; use the normal login token. Moderators and students receive 403; anonymous callers receive 401. Permissions are checked both at the HTTP route and in the directory service.

Search is optional, case-insensitive, and matches literal text in name or email. It is limited to 100 characters and cannot contain control characters. The zero-based `page` defaults to 0; `size` defaults to 20 and must be between 1 and 100. Results are ordered by name and then ID to make ties stable. Invalid input returns 400.

```json
{
  "items": [{
    "id": "64b000000000000000000001",
    "name": "Alex Example",
    "maskedEmail": "***@augustana.edu",
    "emailVerified": true,
    "role": "STUDENT",
    "createdAt": null,
    "updatedAt": null
  }],
  "total": 1,
  "page": 0,
  "size": 20,
  "totalPages": 1
}
```

Dates are returned only if stored on the account; older accounts may have no dates. The email local part is fully masked, and password hashes, tokens, private messages, and user profile contents are never included. The response is not cacheable. The frontend in PR #114 currently expects a bare array and must be updated to read `items` and use server-side search and pagination.
