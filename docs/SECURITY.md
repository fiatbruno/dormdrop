# DormDrop — Security and deployment notes

This document captures known configuration and security considerations from the team's README draft. It is **not** a security audit and does not prove that credential rotations, authorization checks, or deployment hardening have been completed.

## Secrets and previous exposure

- Use environment variables or a trusted secret manager for `MONGODB_URI`, `JWT_SECRET`, `MAIL_USERNAME`, `MAIL_PASSWORD`, and all seeded admin credentials.
- Do not commit real `.env` files, `application.properties` secrets, tokens, passwords, verification URLs, or real-user data.
- **If any secret was committed in the past, rotate/revoke it in the issuing service:** reset the database user's password, revoke SMTP app passwords or API tokens, replace the JWT signing key, and change exposed account passwords. Restart the server with replacement credentials and test that old credentials no longer work.
- Cleaning Git history alone **does not revoke** leaked credentials. Check alerts such as GitHub secret scanning / GitGuardian separately and verify remediation.
- The `JWT_SECRET` must remain consistent between normal restarts when keeping existing sessions; rotating it intentionally invalidates previously issued tokens.
- Keep real personal details, verification tokens, password reset links, and secret credentials out of screenshots and demo recordings.

## Local configuration details

- According to the original project notes, the backend reads environment variables from the process / IDE; it does not automatically load a `.env` file.
- JWT/SMTP/admin values are server-only and must not be placed in frontend `VITE_` variables. Vite exposes those to users' browsers.
- The normal registration flow requires an `@augustana.edu` inbox and a working SMTP configuration.
- The development frontend is expected at `http://localhost:5173`, and the documented REST API base is `http://localhost:8080/api/v1`.
- The backend currently saves listing images to a local `backend/uploads/` directory relative to its working directory; back up or replace that storage before deployment.

## Before deployment

1. Configure production domains, HTTPS, CORS allowed origins, WebSocket origins, verification redirects, and reset URLs; remove localhost references in production configuration.
2. Use managed secrets and least-privilege database credentials; verify secrets previously found in history have been revoked.
3. Review authentication **and object-level authorization** for listings, messages, subscriptions, and file uploads (including access to conversations involving other users).
4. Enforce reasonable upload limits and content validation; decide how uploaded images will persist across restarts/deployments.
5. Implement the password-reset completion page and ensure expired/reused tokens are handled safely.
6. Add and run backend/frontend tests, including API authorization and live-messaging integration cases. Record actual results; do not infer coverage from commands existing.
7. Ensure operational basics: logs without sensitive data, backups, monitoring, and error handling.
8. Use clearly fictional demo accounts and sample listings for screenshots/videos.

## Scope and limitations

The current MVP is described as **local-only**. It does not integrate payments, shipping, or trade settlement. Pickup proposals are documented as backend-capable but not connected to the active frontend. This file makes no claim that production hardening or a formal security review has taken place.
