# Abako Backend

Monorepo for the Abako project backend.

## Quick Start

```bash
pnpm run setup        # install dependencies + build native modules
pnpm run dev:mock     # start the backend (mock-api + adapter-api)
```

API will be available at `http://localhost:4000`, docs at `http://localhost:4000/api-docs`.

```bash
pnpm run test:mock    # run all 87 tests
```

No MongoDB, Docker, or blockchain node required.

## Project Structure

```
backend/
├── packages/
│   ├── adapter-api/      # Main NestJS API (auth, projects, clients, calendar, ratings)
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
| `BRAMP_SERVICE_URL` | `http://localhost:4010` | Bramp payment service / mock-api |
| `JWT_SECRET` | (set in .env) | JWT signing secret |
| `PROVIDER_URL` | (production only) | Blockchain WebSocket URL |
