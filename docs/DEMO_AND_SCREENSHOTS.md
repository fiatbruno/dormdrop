# DormDrop — Demo and screenshot capture guide

## Included in this package

| File | Interface |
| --- | --- |
| `screenshots/01-marketplace.png` | Marketplace homepage, banner, listing grid |
| `screenshots/02-search-and-filters.png` | Listings with advanced filters |
| `screenshots/03-item-details.png` | Listing details and seller actions |
| `screenshots/04-messages-ui-preview.png` | Messaging UI preview with a pickup proposal design |

**Accuracy caveat:** The messaging screenshot includes a pickup proposal UI even though the source README describes the pickup-proposal feature as backend-only. Confirm the live implementation before calling this a functioning feature or demonstrating it as such. These images are not proof of a deployed application.

## Recommended future screenshots

If these screens work in your checkout, capture them using invented sample accounts and listings:

1. Listing creation form with a sample image and selected campus pickup area.
2. Saved listings page showing saved and unsaved states.
3. Profile page with active and sold listings.
4. Signup / email verification success (with all tokens and private information obscured).
5. Actual working chat from two browser sessions, **without** showing unimplemented pickup controls.
6. Mobile-viewport screenshots only after the layouts have been reviewed and tested.

Use consistent sample items and names. Capture desktop at about 1440 × 900; avoid cropping away important context. Screenshots must contain no passwords, real emails, API tokens, or verification/reset URLs. Avoid including fabricated usage metrics.

## Suggested 2–3 minute demo walkthrough

1. Introduce DormDrop and the local-only MVP (10–15 seconds).
2. Sign in using a fictional, pre-verified demo student account (15 seconds).
3. Browse and filter listings; open one item and save it (30 seconds).
4. Create a new listing, upload a sample photo, and show it in the grid (35 seconds).
5. Switch between two local demo accounts/browser profiles, show sending and receiving messages in real time, then reload to demonstrate persistence (45–60 seconds).
6. Show sold-item management or profile as time permits (15 seconds).
7. Briefly explain the React → Spring Boot → MongoDB architecture and STOMP/WebSocket messaging (20 seconds).

When you have a recording, host it somewhere stable (e.g. a public unlisted video or GitHub-compatible link) and replace the README's “Video demo: Not recorded yet” line with its **real verified URL**. Do not add a non-working demo placeholder.
