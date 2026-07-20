# Abako Backend

Monorepo for the Abako project backend.

## Quick Start

```bash
pnpm run setup        # install dependencies + build native modules
pnpm run dev:mock     # start the backend (mock-api + adapter-api)
```

API will be available at `http://localhost:4000`, docs at `http://localhost:4000/api-docs`.

```bash
pnpm run test:mock    # run all 96 tests
```

No MongoDB, Docker, or blockchain node required.

### Frontend integration

In the frontend repo (`abako-web/frontend/`), create `.env.local`:

```
VITE_API_BASE_URL=http://localhost:4000
VITE_USE_MOCK_AUTH=true
VITE_CALENDAR_ADDRESS=mock-calendar-address
```

Then `npm run dev` — the frontend will use mock auth (no WebAuthn/blockchain).

## Project Structure

```
backend/
├── packages/
│   ├── adapter-api/      # Main NestJS API (auth, projects, notifications, calendar, ratings)
│   ├── mock-api/         # Mock server replacing blockchain services for dev/test
│   ├── contracts-api/    # Ink! smart contract interactions (production)
│   └── virto-api/        # Virto blockchain API (production)
├── infrastructure/       # Docker Compose for full blockchain setup
├── setup.sh              # One-command install
└── package.json
```

## Architecture

```
                   Frontend
                      │
                      ▼
              adapter-api :4000        Main API (NestJS + SQLite)
                 │        │
       ┌─────────┘        └──────────┐
       ▼                             ▼
  FEDERATE_SERVER              SIGNING_SERVICE_URL
       │                             │
       ├── Mock mode ─── mock-api :4010 ──┤  (no blockchain)
       │                                  │
       ├── Production ── virto-api :3000  │
       │                 contracts-api :3010
       │                       │
       └───────────────────────┘
                      │
               Kreivo blockchain
```

### Mock mode (default for development)

`pnpm run dev:mock` starts:
- **mock-api** on `:4010` — mocks virto-api, contracts-api, and bramp in a single process
- **adapter-api** on `:4000` — the full NestJS API with SQLite and mock auth

Set by `.env.mock` which configures `USE_MOCK_AUTH=true` and points service URLs at mock-api.

### Production mode

Requires the full infrastructure (blockchain node, MongoDB replaced by SQLite):

```bash
./infrastructure/up.sh      # start Zombienet + services via Docker
pnpm --filter abako-adapter start:dev
```

The real `AuthService` uses `@virtonetwork/sdk` with WebSocket connection to the blockchain.
`USE_MOCK_AUTH` must NOT be set in production.

## Identity Model

Client and developer profiles use `userId` as the primary auth identifier. `email` is optional contact data and remains supported as a legacy lookup fallback, so older email-only profile creation still maps the email value into `userId`.

New integrations should send `userId` when creating client or developer profiles. Do not require users to provide an email address unless the product flow specifically needs one as contact data.

In mock mode, users also have SQLite-backed roles. Registration requires one or more selectable `roleIds`; role `1` is the reserved, non-selectable `coordinator` role and can only be assigned through the mock coordinator endpoint. `user_roles` is the sole source of coordinator eligibility: worker and developer profiles do not persist a duplicate coordinator flag. Current roles are returned by `GET /auth/me` on mock-api and `GET /v1/auth/me` on adapter-api.

## Assignment Workflow

- Project deployment triggers coordinator assignment. The mock contract randomly selects a registered worker whose `userId` has role `1` and whose availability is above zero; ratings are not used.
- Coordinators propose milestones with assignment slots. Each slot contains a stable `assignmentKey`, required `hours`, and catalog `skillIds`; roles and skill names are not stored in assignment payloads.
- Scope approval plans the whole team for every approved milestone. Repeated assignment keys reuse the same eligible worker when possible, then selection prefers existing project members before choosing randomly from the global worker pool.
- Scope approval activates only the first milestone and reserves only its hours. Later assignments do not consume availability until their milestone becomes active.
- Client acceptance of a delivered milestone activates the next milestone. If a planned worker lacks availability, that slot is reassigned from the project team first, then the global pool.
- Activation is atomic. When no valid workers are available, the call fails without activating the milestone or accepting the previous one, and the client can retry later.
- Availability covers the next 12 weeks, defaults to zero, and is capped at 60 hours per week. `PermanentWeeklyHours: 40` keeps future weeks at 40 hours as the window advances.
- Mock roles, user-role assignments, workers, skills, and weekly availability are stored in SQLite. The production smart contract is expected to own equivalent authorization and assignment logic.

## Mock Ledger And Payments

Mock mode includes a SQLite-backed ledger for frontend/dev testing only. Production still uses the blockchain through `virto-api`.

- `assetId=1` is `KVN`.
- `POST /api/fund` credits a dev wallet, defaulting to `1000000` KVN.
- `GET /api/balance?address=<wallet>&assetId=1` returns the current mock balance as a string.
- Payment endpoints live under `/api/payments/*` on `mock-api` and cover create/release, payment requests, refunds, cancellations, and dispute resolution.
- Ledger debits are strict: operations fail when the payer lacks funds; mock balances must not go negative.
- Project scope approval debits the client for the advance payment. Milestone acceptance debits the client and releases the milestone amount to the assigned worker.

Frontend code should treat these endpoints as mock/dev helpers. Do not build production flows around `/api/fund` or the mock SQLite ledger.

## Notifications

`adapter-api` stores notifications per wallet address and exposes an authenticated SSE stream for live updates. Frontends load existing notifications with `GET /v1/notifications`, create a one-use SSE cookie with `POST /v1/events/session`, and then open `GET /v1/events` with `EventSource`.

The full handshake, event shapes, read-state sync, and multi-device behavior are documented in `packages/adapter-api/README.md`.

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm run setup` | Install all dependencies and build native modules |
| `pnpm run dev:mock` | Start mock-api + adapter-api together |
| `pnpm run test:mock` | Run all e2e tests against mock-api |
| `pnpm run mock` | Start only mock-api (with hot reload) |
| `pnpm run mock:test` | Run mock-api smoke tests |
| `pnpm run infra:up` | Start full blockchain infrastructure |
| `pnpm run infra:down` | Stop infrastructure |

## Test Coverage

The e2e test suite covers:
- WebAuthn authentication (registration, connection)
- Client and developer CRUD with image upload
- Project deployment and lifecycle (deploy, coordinator, scope, team, completion)
- Calendar contract (worker registration, availability)
- Mock ledger and payments (funding, release, refunds, disputes, insufficient funds)
- DAO governance (remark referendums)
- Ratings (client, coordinator, developer)
- Bramp integration (deposits, withdrawals)

## Environment Variables

See `packages/adapter-api/.env.mock` for mock mode defaults, or `.env.template` for production.

| Variable | Mock default | Description |
|----------|-------------|-------------|
| `PORT` | `4000` | Adapter API port |
| `SIGNING_SERVICE_URL` | `http://localhost:4010` | Contracts API / mock-api |
| `FEDERATE_SERVER` | `http://localhost:4010/api` | Virto API / mock-api |
| `USE_MOCK_AUTH` | `true` | Use mock auth (no blockchain) |
| `SQLITE_PATH` | `./data/abako.sqlite` | SQLite database path |
| `MOCK_SQLITE_PATH` | `./data/mock-registry.sqlite` | Mock roles, user assignments, workers, skills, and availability registry |
| `MOCK_INITIAL_BALANCES_FILE` | `./data/mock-balances.json` | Mock dev accounts funded with 1000000 KVN |
| `BRAMP_SERVICE_URL` | `http://localhost:4010` | Bramp payment service / mock-api |
| `JWT_SECRET` | (set in .env) | JWT signing secret |
| `PROVIDER_URL` | (production only) | Blockchain WebSocket URL |
