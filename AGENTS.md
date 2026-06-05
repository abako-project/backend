# Repository Notes

## Current Scope

- PR #44 removes the email requirement for client and developer profiles while keeping email as optional legacy contact data.
- The SDK version should stay as currently pinned unless a later task explicitly asks for a version change.
- Authentication/user lookups should use `userId` as the primary identifier and keep `email` only as a compatibility fallback.
