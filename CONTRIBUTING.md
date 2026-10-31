# Contributing to DormDrop

## 1. Claim an issue

Assign yourself to the work issue before starting.
Read its requirements, acceptance criteria, and dependencies.

If you already started on a branch, link that branch or its PR
to the relevant issue. You do not need to restart.

## 2. Work on a branch

Create new branches from an up-to-date main.
Do not commit directly to main.

Use descriptive names, for example:

- feat/48-keyword-search
- fix/listing-refresh
- chore/pr-review-workflow

Keep each new PR focused on one manageable change.
An existing cohesive PR may address multiple issues.

## 3. Test your changes

Run the checks relevant to your change.

Backend, from backend/:

```sh
mvn test
```

Frontend, from frontend/:

```sh
npm ci
npm run lint
npm run build
npm test
```

Frontend browser tests currently require the app to be running.
Follow the Playwright configuration and test setup instructions.

Add meaningful tests for new behavior and bug fixes.
Check relevant failure cases, permissions, and input validation.
Explain any checks you could not run.

Documentation-only changes usually need careful review rather
than application tests.

## 4. Open a pull request

Target main and complete the PR template.

Include:

- The work issue and tracking issue.
- A description of the behavior changed.
- Test commands and results.
- Screenshots for visible UI changes.
- Dependencies, limitations, and configuration changes.

Open a draft PR early when you want to show progress.
Mark it ready for review when the change is ready.

Use "Closes #NUMBER" only when the PR fully completes that issue.
Use "Related to #NUMBER" for partial work.

Do not present mocked frontend tests as proof that the real
frontend and backend work together.

## 5. Request review and address feedback

Request review from the repository owner or designated reviewer.
The PR author must receive approval from another authorized reviewer.

Make corrections on the same branch and push again.
The existing PR updates automatically.

Do not dismiss unresolved feedback or bypass main's review rules.

## 6. Merge and verify

Merge only after required approvals and checks pass,
dependencies are satisfied, and review feedback is resolved.

Verify the completed behavior on main.
A merged PR does not necessarily mean the app has been deployed.

A work issue is complete when its acceptance criteria pass
and its implementation is merged into main.

A tracking issue stays open until the entire user story works,
including frontend/backend integration where applicable.

## Secrets and private data

Never commit .env files, credentials, access tokens, or private data.
Remove sensitive information from screenshots, logs, and test evidence.
