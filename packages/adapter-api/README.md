# Adapter API

## Requirements

- Node.js version 22 or higher
- MongoDB 7.0 or higher

This module provides endpoints to interact with ink!-based project management smart contracts.

## API Versioning

The Adapter API uses **URI versioning**. All endpoints are prefixed with the version number.

### Current Version: v1

All endpoints are accessed through the `/v1/` prefix:

```
GET    /v1/clients
POST   /v1/clients
GET    /v1/developers
POST   /v1/projects/deploy/:version
GET    /v1/auth/check-registered/:userId
POST   /v1/events/session
GET    /v1/events
GET    /v1/notifications
PATCH  /v1/notifications/:id/read
PATCH  /v1/notifications/read-all
```

### Example Usage

```bash
# Create a client profile
curl -X POST http://localhost:3000/v1/clients \
  -H "Content-Type: application/json" \
  -d '{"userId":"client-123","email":"client@example.com","name":"John Doe",...}'

# Get all developers
curl http://localhost:3000/v1/developers

# Deploy a project
curl -X POST http://localhost:3000/v1/projects/deploy/latest \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"My Project",...}'
```

### Version Migration

When a new version is released, the previous version will be maintained for a deprecation period. You will be notified in advance to migrate your integration to the new version.

## Database Configuration

The application requires a MongoDB database connection. Configure the connection using the `MONGODB_URI` environment variable:

```bash
MONGODB_URI=mongodb://admin:admin123@localhost:27017/abako?authSource=admin
```

## DAO Configuration

Configure the default DAO address for project deployments:

```bash
DAO_ADDRESS=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
```

### Docker Compose Setup

When using Docker Compose, MongoDB is automatically configured with:
- **Username:** admin
- **Password:** admin123
- **Database:** abako
- **Port:** 27017
- **Container:** abako-mongodb

The connection is established automatically when the services start.

## Mock Mode (No Blockchain)

For frontend development without the slow dev blockchain infrastructure, use the **mock-api** package. It replaces `virto-api` and `contracts-api` with a single Express server backed by SQLite for mock balances and payments.

### Setup

```bash
# Start the mock server
cd packages/mock-api
pnpm install
pnpm start       # or: pnpm dev (watch mode)
```

Then configure your adapter-api `.env`:

```bash
FEDERATE_SERVER=http://localhost:4010/api
SIGNING_SERVICE_URL=http://localhost:4010
```

Start adapter-api as usual — it will hit the mock instead of the blockchain services.

### What's mocked

- **virto-api**: auth (WebAuthn and password flows), user roles, payments, memberships, balance, fund
- **contracts-api**: project/calendar/ratings contract deploy, query, and call methods

Users, contracts, memberships, and project state are held by the mock process. Roles, user-role assignments, skills, skill-role relationships, worker registry, availability, ledger balances, and payments are persisted in SQLite so frontend dev sessions can inspect real state changes.

### Mock user roles

Both `POST /api/register` and `POST /api/password-register` require a non-empty `roleIds` array. IDs must be unique and refer to selectable roles. The stable catalog is:

| ID | Name | Selectable at registration |
|---:|---|:---:|
| 1 | `coordinator` | No |
| 2 | `frontend` | Yes |
| 3 | `backend` | Yes |
| 4 | `fullstack` | Yes |
| 5 | `designer` | Yes |
| 6 | `qa` | Yes |
| 7 | `architect` | Yes |
| 8 | `embedded` | Yes |
| 9 | `devops` | Yes |

Mock role management endpoints are:

- `GET /api/roles`
- `GET /api/roles/:id`
- `POST /api/roles` with `{ "name": "support" }`
- `PATCH /api/roles/:id` with `{ "name": "customer-support" }`
- `DELETE /api/roles/:id`
- `PATCH /api/users/:userId/coordinator` with `{ "enabled": true }`

Role `1` cannot be renamed or deleted, and an assigned role cannot be deleted. Assigning or removing coordinator preserves the user's selectable roles. `GET /auth/me` on mock-api and `GET /v1/auth/me` on adapter-api query the current SQLite assignments; roles are not copied into JWTs.

A role also cannot be deleted while any skill references it. Seed workers have these roles:

| Worker | Roles |
|---|---|
| Carol, Malik | `backend`, `architect`, `coordinator` |
| Grace | `frontend`, `architect`, `coordinator` |
| Dave, Nina | `frontend`, `fullstack` |
| Eve | `backend`, `qa` |
| Frank | `backend` |
| Heidi | `designer`, `frontend` |
| Ivan, Oscar | `backend`, `devops` |
| Judy | `frontend`, `qa` |
| Priya | `frontend` |

`PUT /v1/developers/:developerId/coordinator-eligibility` remains as a compatibility endpoint. In mock mode it resolves the developer's `userId` and delegates to `PATCH /api/users/:userId/coordinator`; it does not store a boolean on the developer profile. The mock coordinator endpoint is intentionally unauthenticated for local development. Production must implement blockchain-backed authorization before exposing equivalent behavior, so this compatibility endpoint returns `501 Not Implemented` outside mock mode.

### Mock skill-role relationships

Mock mode uses a many-to-many `skill_roles(skill_id, role_id)` table. Skill deletion cascades its relationships; role deletion is restricted. The seed taxonomy is:

| Skills | Role IDs |
|---|---|
| `rust` | 3, 7, 8 |
| `solidity`, `ink`, `substrate` | 3, 7 |
| `typescript`, `javascript` | 2, 3, 4 |
| `node.js` | 3, 4 |
| `react`, `next.js`, `vue`, `react native` | 2, 4 |
| `postgresql` | 3, 4, 7, 9 |
| `sqlite` | 3, 4, 8 |
| `docker` | 3, 7, 9 |
| `kubernetes`, `aws` | 7, 9 |
| `graphql`, `rest api`, `web3` | 2, 3, 4, 7 |
| `smart contract auditing` | 3, 6, 7 |
| `automated testing` | 2, 3, 4, 6, 8, 9 |
| `ui/ux` | 2, 4, 5 |
| `figma` | 2, 5 |
| `communication`, `teamwork`, `time management` | 1–9 |
| `leadership`, `mentoring` | 1, 7 |
| `problem solving`, `adaptability` | 2–9 |
| `stakeholder management`, `facilitation` | 1, 5, 7 |
| `technical writing` | 1, 3, 6, 7, 8, 9 |

The taxonomy is for catalog discovery only. A proposal may request a skill that is not cataloged under its role; matching succeeds when a registered worker owns both the requested role and all requested skills.

Public adapter endpoints:

- `POST /v1/skills` with `{ "name": "figma", "category": "software", "roleIds": [2, 5] }` creates or retrieves the normalized skill and replaces its complete role set. `roleIds` must be non-empty, unique positive integers referencing existing roles. The response is `{ "skill": { "id", "name", "category", "roleIds" } }`.
- `GET /v1/skills` keeps the legacy `{ "skills": [...] }` response.
- `GET /v1/skills/ids?roleId=2` returns `{ "skillIds": [...] }`, sorted by ID. Without `roleId`, it returns every skill ID. Invalid IDs return `400`; unknown roles return `404`.
- `GET /v1/skills/:skillId` returns `{ "name": "figma" }`. Invalid IDs return `400`; unknown skills return `404`.

The internal mock equivalents are `POST /mock/skills`, `GET /mock/skills`, `GET /mock/skills/ids`, and `GET /mock/skills/:skillId`. The mock also exposes `GET` and `PUT /mock/users/:userId/qualifications` for complete `{ "skillIds": [...], "roleIds": [...] }` replacement. These are provider-internal routes; frontend clients use the adapter profile and catalog endpoints.

`mock-api` is the only source of truth for the skill catalog, skill-role relationships, and user skill/role assignments. The adapter has no skill table and the `developers` table has no skill or role columns. `GET /v1/developers` and `GET /v1/developers/:developerId` compose local profile metadata with live mock-owned `skills` and `roleIds`. Bearer-authenticated `PUT /v1/developers/:developerId` requires both arrays and writes the qualifications to the mock; only the profile owner may call it, and `userId` cannot be changed through this endpoint. A new free-form skill name is created in the mock catalog using the submitted profile role IDs; numeric strings from multipart forms continue to resolve as catalog IDs.

Calendar registration sends only worker wallet addresses. Automatic coordinator and team selection runs inside the mock against its own roles, skills, and availability. Outside mock mode, catalog and qualification operations return `501 Not Implemented` until the production smart contract replaces the mock directly; no adapter mirror is intended.

### Role-aware proposal requirements

Every milestone assignment requirement is:

```json
{
  "assignmentKey": "frontend-1",
  "roleId": 2,
  "hours": 40,
  "skillIds": [5, 8]
}
```

The adapter persists `roleId`, sends it to mock contracts as `role_id`, and stores it on `milestone_assignments`. Mock approval requires a worker with that role and every listed skill. If any requirement has no candidate, approval returns `400` atomically without assignments or partial availability reservations.

### Mock ledger and payment endpoints

These endpoints are available on `mock-api` through `FEDERATE_SERVER` (`http://localhost:4010/api` by default). They are dev-only helpers; production uses the blockchain and `virto-api`.

#### GET /api/balance?address=&assetId=1

Returns the current mock balance for a wallet. Balances are strings because token amounts can exceed JavaScript safe integers.

```json
{
  "balance": "1000000",
  "assetId": 1
}
```

#### POST /api/fund

Credits a mock wallet for local testing.

```json
{
  "address": "5...",
  "assetId": 1,
  "amount": "1000000"
}
```

`assetId` defaults to `1`, which is `KVN`. `amount` defaults to `"1000000"`.

#### Payment lifecycle endpoints

- `GET /api/payments/health`
- `POST /api/payments/create` with `{ senderAddress, recipientAddress, amount, assetId?, remark? }`
- `GET /api/payments/get?paymentId=`
- `POST /api/payments/release` with `{ paymentId }`
- `POST /api/payments/request-payment` with `{ senderAddress, recipientAddress, amount, assetId?, remark? }`
- `POST /api/payments/accept-and-pay` with `{ paymentId }`
- `POST /api/payments/request-refund` with `{ paymentId }`
- `POST /api/payments/cancel` with `{ paymentId }`
- `POST /api/payments/dispute-refund` with `{ paymentId }`
- `POST /api/payments/resolve-dispute` with `{ paymentId, percentBeneficiary }`

Supported mock payment states are `Created`, `Released`, `PaymentRequested`, `Completed`, `RefundRequested`, `Cancelled`, `Refunded`, `NeedsReview`, and `DisputeResolved`.

The mock ledger is strict: a debit fails when the sender does not have enough KVN. There are no fees, scheduler, incentives, or production chain holds in mock mode.

Project scope approval creates an advance payment from the client. Accepting a milestone creates and releases a milestone payment to the assigned worker.

## API Documentation

Interactive API documentation is available at:
- **Swagger UI:** `http://localhost:3000/api-docs`
- **OpenAPI JSON:** `http://localhost:3000/api-docs/json`

The Swagger UI provides a complete overview of all endpoints, request/response schemas, and allows you to test the API directly from your browser.

## Available Endpoints

> **Note:** All endpoints require the `/v1/` prefix. See [API Versioning](#api-versioning) section above.

### Authentication Endpoints (`/v1/auth`)

#### GET /v1/auth/check-registered/:userId
Check if a user is registered

#### POST /v1/auth/custom-register
Register a new user with WebAuthn

#### POST /v1/auth/connect
Connect and authenticate user

#### POST /v1/auth/sign
Sign extrinsic data

### Event and Notification Endpoints

The notification system has two parts:

- persisted notifications in the database;
- a Server-Sent Events stream used to push live updates to every active device for the same wallet.

The wallet address inside the normal login JWT is the notification recipient. Clients never send a wallet/user id to subscribe. The backend derives it from auth and stores every notification with `recipientAddress`.

#### Notification lifecycle

1. A project operation publishes an event, for example `project.scope_proposed`.
2. The backend resolves the affected wallet addresses.
3. One `notifications` row is stored for each affected wallet.
4. The same event is pushed over SSE to every open stream for those wallets.
5. The frontend loads existing notifications from `GET /v1/notifications` on page load.
6. After the initial load, the frontend stays in sync by listening to SSE.

Read notifications are kept in the database. "Clear notifications" means marking them as read, not deleting them.

#### SSE authentication model

Native `EventSource` cannot send an `Authorization` header. To keep the SSE stream authenticated without putting JWTs in the URL, the backend uses a short-lived, one-use, HttpOnly cookie.

The cookie contains an opaque random token, not the user's JWT and not the wallet address. The backend stores this token in memory with the wallet address for 60 seconds:

```txt
opaque token -> { recipientAddress, expiresAt }
```

When `/v1/events` consumes the token, it deletes it. If the same token is reused, the request is rejected.

This is intentionally in-memory because the SSE broker is also in-memory. If the backend runs multiple instances, both the pending SSE tokens and event fanout need shared storage/pubsub, such as Redis.

#### Per-device SSE handshake

Each device or browser tab opens its own SSE channel. The flow is:

1. The frontend already has a normal login JWT.
2. The frontend asks the backend to create a one-use SSE cookie.
3. The frontend opens `EventSource` with credentials.
4. If the stream disconnects, the frontend repeats the same handshake.

```ts
async function openNotificationsStream(token: string) {
  await fetch('/v1/events/session', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });

  const source = new EventSource('/v1/events', {
    withCredentials: true,
  });

  source.addEventListener('project.scope_proposed', (event) => {
    const notificationEvent = JSON.parse(event.data);
    // Add/update this notification in the local UI state.
  });

  source.addEventListener('notification.read', (event) => {
    const { id, readAt } = JSON.parse(event.data).data;
    // Mark this notification as read locally.
  });

  source.addEventListener('notification.read_all', (event) => {
    const { ids, readAt } = JSON.parse(event.data).data;
    // Mark all listed notifications as read locally.
  });

  source.onerror = () => {
    source.close();
    // Request a fresh one-use cookie and create a new EventSource.
    void openNotificationsStream(token);
  };

  return source;
}
```

If a user opens the app on two devices, both devices repeat this handshake independently. Both streams are tied to the same wallet, so both receive new notification events and read-state events.

#### Initial notification pull

On page load, fetch the current database state before opening or while opening SSE:

```ts
const unread = await fetch('/v1/notifications?status=unread', {
  headers: { Authorization: `Bearer ${token}` },
}).then((response) => response.json());
```

Supported filters:

- `GET /v1/notifications?status=unread`: only unread notifications.
- `GET /v1/notifications?status=read`: only read notifications.
- `GET /v1/notifications?status=all`: all notifications.
- `GET /v1/notifications`: defaults to all notifications.

The response is an array of persisted notification rows:

```json
[
  {
    "id": "notification-uuid",
    "eventId": "event-id",
    "recipientAddress": "5...",
    "type": "project.scope_proposed",
    "projectId": "project-uuid",
    "data": {
      "projectId": "project-uuid",
      "contractAddress": "5...",
      "state": "scope_proposed"
    },
    "readAt": null,
    "createdAt": "2026-06-29T12:00:00.000Z"
  }
]
```

#### POST /v1/events/session

Create a one-use SSE session cookie from the current bearer JWT.

```bash
curl -i -X POST http://localhost:3000/v1/events/session \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Successful response:

```http
HTTP/1.1 204 No Content
Set-Cookie: abako_sse_token=<opaque-token>; HttpOnly; Path=/v1/events; Max-Age=60; SameSite=Lax
```

In production, the cookie also gets `Secure`.

#### GET /v1/events

Open the SSE stream. This endpoint uses the `abako_sse_token` cookie and does not accept `userId`, wallet address, or bearer auth.

```ts
new EventSource('/v1/events', { withCredentials: true });
```

The first event confirms the stream is open:

```txt
event: connected
data: {"type":"connected","timestamp":"..."}
```

Domain notifications use their domain event type:

```txt
event: project.scope_proposed
data: {"id":"...","type":"project.scope_proposed","timestamp":"...","projectId":"...","data":{...}}
```

Read-state sync events are:

```txt
event: notification.read
data: {"id":"...","type":"notification.read","timestamp":"...","data":{"id":"notification-uuid","readAt":"..."}}

event: notification.read_all
data: {"id":"...","type":"notification.read_all","timestamp":"...","data":{"ids":["notification-uuid"],"readAt":"..."}}
```

#### PATCH /v1/notifications/:id/read

Mark one notification as read. The backend only updates the notification if it belongs to the wallet in the bearer JWT.

```bash
curl -X PATCH http://localhost:3000/v1/notifications/notification-uuid/read \
  -H "Authorization: Bearer YOUR_TOKEN"
```

After updating the database, the backend broadcasts `notification.read` to every active SSE stream for that wallet. This keeps other tabs/devices in sync without calling `GET /v1/notifications` again.

#### PATCH /v1/notifications/read-all

Mark all unread notifications for the authenticated wallet as read.

```bash
curl -X PATCH http://localhost:3000/v1/notifications/read-all \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:

```json
{
  "ids": ["notification-uuid-1", "notification-uuid-2"],
  "readAt": "2026-06-29T12:00:00.000Z",
  "count": 2
}
```

The backend broadcasts `notification.read_all` to every active SSE stream for that wallet with the changed notification ids.

#### CORS for EventSource

If the frontend and backend are cross-origin, configure `CORS_ORIGIN` in `.env`:

```bash
CORS_ORIGIN=http://localhost:3000
```

The frontend must use `credentials: 'include'` for `POST /v1/events/session` and `withCredentials: true` for `EventSource`.

### Client Endpoints (`/v1/clients`)

#### POST /v1/clients
Create a new client profile

#### GET /v1/clients
Get all clients

#### GET /v1/clients/:clientId
Get client by ID

#### PUT /v1/clients/:clientId
Update client profile

#### GET /v1/clients/:clientId/attachment
Get client profile image

#### GET /v1/clients/:clientId/projects
Get all projects for a client

### Developer Endpoints (`/v1/developers`)

#### POST /v1/developers
Create a new developer profile

#### GET /v1/developers
Get all developers

#### GET /v1/developers/:developerId
Get developer by ID

#### PUT /v1/developers/:developerId
Update the authenticated user's developer profile and replace its provider-owned `skills` and `roleIds`. Requires `Authorization: Bearer <token>` and does not allow changing `userId`.

#### GET /v1/developers/:developerId/attachment
Get developer profile image

#### GET /v1/developers/:developerId/projects
Get all projects for a developer (as consultant)

#### GET /v1/developers/:developerId/milestones
Get all milestones assigned to a developer

### Project Endpoints (`/v1/projects`)

#### POST /v1/projects/deploy/:version
Deploy a new project contract

#### PUT /v1/projects/:contractAddress
Update project information

#### POST /v1/projects/:contractAddress/reject_scope
Reject project scope

#### POST /v1/projects/:contractAddress/assign_coordinator
Assign coordinator to project

#### POST /v1/projects/:projectId/milestones
Create milestone

#### GET /v1/projects/:projectId/milestones
Get project milestones

#### GET /v1/projects/:projectId/milestones/:milestoneId
Get milestone by ID

#### PUT /v1/projects/:projectId/milestones/:milestoneId
Update milestone

#### DELETE /v1/projects/:projectId/milestones/:milestoneId
Delete milestone

### Contract Method Calls

#### POST /v1/projects/:contractAddress/call/:method
Calls a specific method of the projects contract (write methods).

**Parameters:**
- `contractAddress`: Contract address (SS58 format)
- `method`: Method to call

**Body (optional):**
```json
{
  "data": {
    // Method-specific parameters
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/call/5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY/assign_coordinator \
  -H "Content-Type: application/json" \
  -d '{"data": {}}'
```

#### GET /query/:contractAddress/:method
Gets information from a contract method (read-only methods).

**Example:**
```bash
curl "http://localhost:3000/query/5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY/get_project_info"
```

### Contract Deployment

#### POST /deploy/:version
Deploys a new projects contract.

**Body:**
```json
{
  "source": {
    "hash": "0xb1e35aa9e966c669f8d947548df0ff7e9e3a09feb949fd9cb01d5659f21b084d",
    "language": "ink! 5.1.1",
    "compiler": "rustc 1.89.0",
    "build_info": {
      "build_mode": "Release",
      "cargo_contract_version": "5.0.3",
      "rust_toolchain": "stable-x86_64-unknown-linux-gnu",
      "wasm_opt_settings": {
        "keep_debug_symbols": false,
        "optimization_passes": "Z"
      }
    }
  },
  "contract": {
    "name": "projects",
    "version": "0.1.0",
    "authors": ["[your_name] <[your_email]>"]
  },
  "spec": {
    // Contract ABI
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/deploy/v6 \
  -H "Content-Type: application/json" \
  -d '{"source": {...}, "contract": {...}, "spec": {...}}'
```

## Supported Methods

### Write Methods
- `assign_coordinator`: Assigns a coordinator to the project
- `assign_team`: Assigns team members
- `mark_completed`: Marks the project as completed
- `set_calendar_contract`: Sets the calendar contract
- `propose_scope`: Proposes the project scope
- `approve_scope`: Approves the proposed scope
- `complete_task`: Marks a task as completed

### Read Methods
- `get_project_info`: Gets basic project information
- `get_team`: Gets the list of team members
- `get_scope_info`: Gets project scope information
- `get_task`: Gets a specific task
- `get_task_completion_status`: Checks the completion status of a task
- `get_all_tasks`: Gets all project tasks

## Response

All endpoints return an object with the following structure:

```json
{
  "extrinsic": "0x...",
  "method": "method_name",
  "contractAddress": "contract_address"
}
```

The `extrinsic` field contains the extrinsic ready to be signed and sent to the blockchain.

## Validations

- Contract addresses must be 48 characters long and start with '5'
- Methods must be in the list of supported methods
- Input data is validated according to the method type

## Polkadot Integration

The module uses the Polkadot API to generate extrinsics compatible with the Kreivo network. Generated extrinsics can be signed and sent using any Polkadot-compatible client.
