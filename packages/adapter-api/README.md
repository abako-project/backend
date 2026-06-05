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

For frontend development without the slow dev blockchain infrastructure, use the **mock-api** package. It replaces `virto-api` and `contracts-api` with a single in-memory Express server.

### Setup

```bash
# Start the mock server
cd packages/mock-api
pnpm install
pnpm start       # or: pnpm dev (watch mode)
```

Then configure your adapter-api `.env`:

```bash
FEDERATE_SERVER=http://localhost:4000/api
SIGNING_SERVICE_URL=http://localhost:4000
```

Start adapter-api as usual — it will hit the mock instead of the blockchain services. MongoDB is still required.

### What's mocked

- **virto-api**: auth (WebAuthn flow), payments, memberships, balance, fund
- **contracts-api**: project/calendar/ratings contract deploy, query, and call methods

All state is in-memory and resets on restart. Contract interactions are stateful within a session (e.g. deploying a project then querying it returns consistent data).

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
Update developer profile

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
