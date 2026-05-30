# Repository Notes

## Current Scope

- PR #44 removes the email requirement for client and developer profiles while keeping email as optional legacy contact data.
- The SDK version should stay as currently pinned unless a later task explicitly asks for a version change.
- Authentication/user lookups should use `userId` as the primary identifier and keep `email` only as a compatibility fallback.

## Pending Product Decisions

- Partial registration flow: define the exact lifecycle, minimum required fields, and transitions. The current proposal is `pending_registration` for incomplete profiles, `waiting_approval` after required data is completed, and `member` after DAO approval.
- DAO approval behavior: define which actor or endpoint advances a profile from `waiting_approval` to `member`, what gets persisted, and how rejected or expired registrations behave.
- Assignment algorithm improvements: define how skills are represented, which skills are required versus optional, and how skills should be weighted against availability, rating, coordinator history, or other assignment signals.
- Assignment observability: define whether the API should expose why a developer was selected or skipped when automatic assignment runs.
