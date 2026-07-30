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

## Mock Ledger And Payments

- Mock ledger/payments are dev-only behavior in `packages/mock-api`; production must keep using blockchain + `virto-api`.
- `assetId=1` is `KVN`. Keep multi-asset support in request shapes, but do not invent other seeded assets unless requested.
- The mock ledger is strict: debits must fail on insufficient funds and balances must never go negative.
- `POST /api/fund` and `GET /api/balance` are frontend/dev helpers for mock mode only.
- Mock payment endpoints under `/api/payments/*` simulate `pallet-payments` state transitions without fees, scheduler, incentives, or real chain holds.
- Project scope approval and milestone acceptance should route through the mock payment/ledger behavior in mock mode, while production remains chain-backed.
- Do not commit generated SQLite files from mock runs. Keep only intentional seed/config files such as `packages/mock-api/data/mock-balances.json`.

## Task Storages

- Proposals and task storages are mock-owned until their smart contracts exist; adapter-api is middleware and must not persist a source-of-truth mirror.
- Creating a draft proposal atomically creates one empty hash-addressed task storage per milestone. The coordinator populates every storage before submitting the proposal for client approval.
- Tasks are keyed by provider-generated `u32` IDs and have no embedded ID. Provider-generated creation/update timestamps use Unix seconds, while estimated and logged work use integer minutes.
- Storage reads require an authenticated project participant. The coordinator may create and fully edit tasks; an assignee may update only status and logged minutes; the client is read-only. Tasks are not deleted.
- Proposal actions are distinct: the coordinator creates/updates/submits; the client approves, requests changes with a required HTTPS URL, or cancels. Reassigning a task is tracking-only and does not alter milestone matching, availability, or payments.

## Skills, Roles, And Matching

- In mock mode, `mock-api` is the only source of truth for skill and role catalogs, skill-role relationships, user qualifications, worker availability, and automatic coordinator/team selection.
- `adapter-api` must not add a skill/role mirror or qualification columns. Developer profile reads compose local metadata with live provider-owned `skills` and `roleIds`; authenticated profile updates write those qualifications to the provider.
- Calendar registration sends wallet addresses only. Matching must read roles and skills from mock storage and require the requested role plus every requested skill.
- Skill-role catalog relationships are for discovery and do not restrict proposal requirements.
- Outside mock mode, provider-dependent catalog and qualification operations return `501` until the production smart contract replaces the mock directly.
- Keep the frontend project lifecycle guide at `packages/adapter-api/docs/project-happy-path-e2e-flow.md` aligned with the E2E.

## Documentation Expectations

- Keep `packages/adapter-api/README.md` as the source of truth for notification/SSE endpoint contracts and frontend handshake examples.
- Keep `README.md` linked to the frontend project happy-path guide.
- If event names, payload shape, auth flow, or notification read behavior changes, update the README in the same change.
- If mock ledger/payment endpoint behavior changes, update `README.md`, `packages/adapter-api/README.md`, and this file in the same change.
