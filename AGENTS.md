# Repository Notes

## Current Scope

- PR #44 removes the email requirement for client and developer profiles while keeping email as optional legacy contact data.
- The SDK version should stay as currently pinned unless a later task explicitly asks for a version change.
- Authentication/user lookups should use `userId` as the primary identifier and keep `email` only as a compatibility fallback.

## Tooling

- Use `pnpm` for installs, scripts, builds, and tests. Do not reintroduce npm lockfiles or Lerna.
- Prefer `pnpm --filter abako-adapter build` for adapter-api compile checks.
- Use `pnpm run test:mock` as the main integration regression check.
- The worktree may contain unrelated local changes. Do not stage, commit, revert, or format files outside the requested scope.

## Adapter API Notifications

- Notifications are wallet-scoped. The wallet address from the authenticated JWT is the notification recipient.
- Do not accept `userId`, wallet address, or recipient address from the frontend for SSE subscription or notification reads.
- `GET /v1/events` is authenticated through the `abako_sse_token` HttpOnly cookie only. It must not use `?userId=`.
- `POST /v1/events/session` validates the normal bearer JWT, derives the wallet address, stores a short-lived opaque token in memory, and sets the SSE cookie.
- The SSE cookie token is one-use. Reconnects must call `POST /v1/events/session` again before creating a new `EventSource`.
- Persist notifications before emitting live project events so users can load missed notifications with `GET /v1/notifications`.
- Marking notifications read must only affect rows for the wallet in the bearer JWT.
- Read-state changes should be broadcast to all active streams for that wallet with `notification.read` or `notification.read_all`.
- In-memory SSE routing and one-use token storage assume a single backend instance. Add Redis/pubsub or equivalent before running multiple adapter-api instances.

## Documentation Expectations

- Keep `packages/adapter-api/README.md` as the source of truth for notification/SSE endpoint contracts and frontend handshake examples.
- If event names, payload shape, auth flow, or notification read behavior changes, update the README in the same change.
