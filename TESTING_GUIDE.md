# PolkaTalent Backend - Testing Guide

This comprehensive testing guide covers the setup, execution, and verification of the PolkaTalent backend implementation for Milestone 1 of the Web3 Foundation grant.

## Table of Contents

- [Overview](#overview)
- [Test Environment Setup](#test-environment-setup)
- [Architecture Overview](#architecture-overview)
- [Module Testing](#module-testing)
  - [Authentication Module](#authentication-module)
  - [Calendar Module](#calendar-module)
  - [Projects Module](#projects-module)
- [Complete End-to-End Flow](#complete-end-to-end-flow)
- [API Reference with Examples](#api-reference-with-examples)
- [Troubleshooting](#troubleshooting)

---

## Overview

The PolkaTalent backend implements key features for the Milestone 1 deliverables:

- **DAO Creation & Governance**: via Communities pallet
- **Pass Pallet**: WebAuthn-based feeless authentication
- **Developer Listings**: Project proposal and deployment
- **Matching Algorithm**: Automatic coordinator and team assignment
- **Escrow & Payments**: Milestone-based smart contract payouts
- **Reputation System**: Rating-based feedback (0-10 scale)

---

## Test Environment Setup

### Prerequisites

Ensure you have the following installed:

```bash
# Check versions
node --version  # Should be >= 22.x
pnpm --version  # Should be >= 9.x
docker --version
docker-compose --version
```

### Infrastructure Startup

The testing environment uses Docker Compose to orchestrate:
- **Zombienet**: Kreivo parachain local testnet
- **contracts-api**: Smart contract interaction service
- **virto-api**: VOS mock server (federate_server)
- **adapter-api**: Main API orchestrator

```bash
# From project root
cd backend

# Start all services
./infrastructure/up.sh

# Wait for services to be healthy (check logs)
./infrastructure/logs.sh zombienet   # Should show "Chain ready"
./infrastructure/logs.sh contracts-api
./infrastructure/logs.sh virto-api
./infrastructure/logs.sh adapter-api
```

**Service URLs:**
- Zombienet: `ws://localhost:21000`
- contracts-api: `http://localhost:3010`
- virto-api: `http://localhost:3000`
- adapter-api: `http://localhost:4000`

### Verify Services

```bash
# Check Zombienet health
curl -X POST http://localhost:21000 \
  -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "system_health"}'

# Expected: {"jsonrpc":"2.0","result":{"peers":0,"isSyncing":false,"shouldHavePeers":false},"id":1}

# Check adapter-api
curl http://localhost:4000/api-docs

# Check virto-api
curl http://localhost:3000/api-docs

# Check contracts-api
curl http://localhost:3010/health
```

---

## Architecture Overview

```
┌──────────────┐
│   Client     │
│   (Tests)    │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────┐
│       adapter-api (Port 4000)        │
│  ┌────────────┬──────────┬─────────┐ │
│  │   Auth     │ Calendar │Projects │ │
│  └────────────┴──────────┴─────────┘ │
└───────┬──────────────────┬───────────┘
        │                  │
        ▼                  ▼
┌───────────────┐   ┌──────────────────┐
│   virto-api   │   │  contracts-api   │
│  (Port 3000)  │   │   (Port 3010)    │
│               │   │                  │
│ - Pass.register│   │ - Ink! v5 SDK   │
│ - add_member  │   │ - Projects      │
│ - Balances    │   │ - Calendar      │
└───────┬───────┘   └────────┬─────────┘
        │                    │
        └────────┬───────────┘
                 ▼
        ┌─────────────────┐
        │   Zombienet     │
        │  (Port 21000)   │
        │                 │
        │ Kreivo Testnet  │
        └─────────────────┘
```

---

## Module Testing

### Authentication Module

The authentication module implements **Pass Pallet** for feeless, accountless authentication using WebAuthn.

#### Test: Check Registration Status

**Endpoint:** `GET /auth/check-registered/:userId`

**Request:**
```bash
curl -X GET http://localhost:4000/auth/check-registered/test-user@example.com
```

**Response:**
```json
{
  "userId": "test-user@example.com",
  "isRegistered": false
}
```

#### Test: Register New User

**Endpoint:** `POST /auth/custom-register`

**Flow:**
1. Client prepares attestation using Virto SDK
2. Backend receives prepared data
3. Backend calls `Pass.register` extrinsic
4. Backend calls `Communities.add_member` to join DAO
5. Backend returns success + transfers initial funds

**Request Body:**
```json
{
  "attestation": {
    "authenticator_data": "0x...",
    "client_data": "0x...",
    "public_key": "0x...",
    "meta": {
      "deviceId": "0x...",
      "context": 0,
      "authority_id": "0x..."
    }
  },
  "hashedUserId": "0x...",
  "credentialId": "...",
  "userId": "test-user@example.com",
  "passAccountAddress": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
}
```

**Example using SDK:**
```typescript
import { SDK } from '@virtonetwork/sdk';

const sdk = new SDK({
  federate_server: 'http://localhost:3000/api',
  provider_url: 'ws://localhost:21000',
});

const userData = {
  profile: {
    id: 'test-user@example.com',
    name: 'Test User',
  }
};

// Prepare registration (client-side)
const preparedData = await sdk.auth.prepareRegistration(userData);

// Send to backend
const response = await fetch('http://localhost:4000/auth/custom-register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(preparedData)
});

const result = await response.json();
// result.success === true
```

**Response:**
```json
{
  "success": true,
  "message": "Registration completed successfully",
  "data": {
    "ok": true
  }
}
```

**What happens on-chain:**
1. `Pass.register` creates WebAuthn credential
2. `Communities.add_member` adds user to DAO (COMMUNITY_ID=1)
3. `Balances.transfer_keep_alive` sends 10 KSM
4. User receives Pass account address for feeless transactions

#### Test: Connect Existing User

**Endpoint:** `POST /auth/custom-connect`

**Request:**
```bash
curl -X POST http://localhost:4000/auth/custom-connect \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user@example.com"}'
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "extrinsic": "0x..."
}
```

**Token contains:**
- User ID
- Pass account address
- Expiry: 10 minutes (configurable via JWT_EXPIRES_IN)

#### Test: Sign Transaction

**Endpoint:** `POST /auth/sign`

**Request:**
```bash
curl -X POST http://localhost:4000/auth/sign \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "extrinsic": "0x..."
  }'
```

**Response:**
```json
{
  "success": true,
  "ok": true,
  "signature": "0x...",
  "signedExtrinsic": "0x..."
}
```

**Error cases:**
```json
// Expired token
{
  "success": false,
  "error": "Token has expired, please reconnect",
  "code": "E_JWT_EXPIRED"
}

// Invalid token
{
  "success": false,
  "error": "Invalid token",
  "code": "E_JWT_INVALID"
}

// Session not found
{
  "success": false,
  "error": "Session not found, please reconnect",
  "code": "E_SESSION_NOT_FOUND"
}
```

---

### Calendar Module

The calendar module manages developer availability for the matching algorithm.

#### Test: Deploy Calendar Contract

**Endpoint:** `POST /calendar/deploy/v5`

**Request:**
```bash
curl -X POST http://localhost:4000/calendar/deploy/v5 \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "success": true,
  "address": "5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpnhM",
  "transactionHash": "0x...",
  "blockHash": "0x...",
  "blockNumber": "12345"
}
```

#### Test: Register Worker

**Endpoint:** `POST /calendar/:contractAddress/register_worker`

**Request:**
```bash
curl -X POST http://localhost:4000/calendar/5C4hrfjw.../register_worker \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "worker": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
  }'
```

**Response:**
```json
{
  "success": true,
  "transactionHash": "0x...",
  "blockHash": "0x...",
  "blockNumber": "12346"
}
```

#### Test: Set Availability

**Endpoint:** `POST /calendar/:contractAddress/set_availability`

**Availability types:**
- `{ type: "WeeklyHours", value: 40 }`: Full-time (40 hrs/week)
- `{ type: "WeeklyHours", value: 20 }`: Part-time (20 hrs/week)
- `{ type: "Unavailable", value: 0 }`: Not available

**Request:**
```bash
curl -X POST http://localhost:4000/calendar/5C4hrfjw.../set_availability \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "availability": { "type": "WeeklyHours", "value": 40 }
  }'
```

**Response:**
```json
{
  "success": true,
  "transactionHash": "0x...",
  "blockHash": "0x...",
  "blockNumber": "12347"
}
```

#### Test: Query Worker Availability

**Endpoint:** `GET /calendar/:contractAddress/get_availability_hours?worker=<address>`

**Request:**
```bash
curl "http://localhost:4000/calendar/5C4hrfjw.../get_availability_hours?worker=5GrwvaEF..."
```

**Response:**
```json
{
  "success": true,
  "response": {
    "type": "WeeklyHours",
    "value": 40
  }
}
```

#### Test: Get Available Workers

**Endpoint:** `GET /calendar/:contractAddress/get_available_workers`

**Request:**
```bash
curl "http://localhost:4000/calendar/5C4hrfjw.../get_available_workers"
```

**Response:**
```json
{
  "success": true,
  "response": [
    "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
    "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty"
  ]
}
```

#### Test: Admin Bulk Operations

**Endpoint:** `POST /calendar/:contractAddress/admin_set_worker_availability`

Useful for testing scenarios with multiple developers.

**Request:**
```bash
curl -X POST http://localhost:4000/calendar/5C4hrfjw.../admin_set_worker_availability \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "worker": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
    "availability": { "type": "WeeklyHours", "value": 20 }
  }'
```

---

### Projects Module

The projects module implements project proposals, matching algorithm, escrow, and milestone-based payments.

#### Test: Deploy Project Contract

**Endpoint:** `POST /projects/deploy/v5`

**Request:**
```bash
curl -X POST http://localhost:4000/projects/deploy/v5 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project",
    "dao_address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
    "calendar_contract": "5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpnhM"
  }'
```

**Response:**
```json
{
  "success": true,
  "address": "5EYCAe5ijiYfyeZ2JJCGq56LmPyNRAKzpG4QkoQkkQNB5e6Z",
  "transactionHash": "0x...",
  "blockHash": "0x...",
  "blockNumber": "12350"
}
```

**Contract initialized with:**
- Client: token owner's address
- DAO: specified dao_address (for governance)
- Calendar: specified calendar_contract (for matching)
- Status: `WaitingForCoordinator`

#### Test: Assign Coordinator

**Endpoint:** `POST /projects/:contractAddress/assign_coordinator`

**Algorithm:**
- Queries calendar contract: `get_available_workers()`
- Selects first available worker with availability > 0
- Sets as coordinator in project contract
- Updates status to `CoordinatorAssigned`

**Request:**
```bash
curl -X POST http://localhost:4000/projects/5EYCAe5i.../assign_coordinator \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "success": true,
  "transactionHash": "0x...",
  "blockHash": "0x...",
  "blockNumber": "12351",
  "dispatchError": null
}
```

**Verification:**
```bash
curl "http://localhost:4000/projects/5EYCAe5i.../get_project_info"
```

**Response shows coordinator:**
```json
{
  "success": true,
  "response": [
    "Test Project",
    "5GrwvaEF...", // client
    "5GrwvaEF...", // dao_address
    "5FHneW46...", // coordinator (assigned)
    {"type": "CoordinatorAssigned"},
    "0", // total_cost
    "0"  // paid_amount
  ]
}
```

#### Test: Assign Team

**Endpoint:** `POST /projects/:contractAddress/assign_team`

**Algorithm:**
- Queries calendar contract: `get_available_workers()`
- Filters out coordinator
- Selects workers with availability > 0
- Creates `TeamMember` structs with role assignment
- Updates status to `TeamAssigned`

**Request:**
```bash
curl -X POST http://localhost:4000/projects/5EYCAe5i.../assign_team \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "_team_size": 2
  }'
```

**Response:**
```json
{
  "success": true,
  "ok": true,
  "signature": "0x...",
  "signedExtrinsic": "0x..."
}
```

**Verification:**
```bash
curl "http://localhost:4000/projects/5EYCAe5i.../get_team"
```

**Response:**
```json
{
  "success": true,
  "response": [
    {
      "account_id": "5FHneW46...",
      "role": {"type": "Backend"},
      "rating": null
    },
    {
      "account_id": "5DAAnrj7...",
      "role": {"type": "Frontend"},
      "rating": null
    }
  ]
}
```

#### Test: Propose Scope (Milestones)

**Endpoint:** `POST /projects/:contractAddress/propose_scope`

**Only coordinator can call this.**

**Task structure:**
```typescript
[
  task_id: number,
  complexity: { type: 'Days' | 'Hours', value: number },
  cost: bigint, // in smallest unit (e.g., 1000 = 0.001 KSM)
  dependencies: number[] // array of task_id dependencies
]
```

**Request:**
```bash
curl -X POST http://localhost:4000/projects/5EYCAe5i.../propose_scope \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "tasks": [
      [1, { "type": "Days", "value": 5 }, 1000, []],
      [2, { "type": "Days", "value": 3 }, 800, [1]],
      [3, { "type": "Days", "value": 2 }, 500, []]
    ],
    "advance_payment_percentage": 20,
    "document_hash": "0x0000000000000000000000000000000000000000000000000000000000000000"
  }'
```

**Fields:**
- `tasks`: Array of milestones/tasks
- `advance_payment_percentage`: 0-100 (20 = 20% upfront)
- `document_hash`: Hash of project specification (32 bytes)

**Response:**
```json
{
  "success": true,
  "ok": true,
  "signature": "0x...",
  "signedExtrinsic": "0x..."
}
```

**What happens:**
1. Coordinator proposes scope with tasks
2. Total cost calculated: 1000 + 800 + 500 = 2300
3. Advance payment: 20% = 460
4. Status updates to `ScopeProposed`
5. Client can now approve/reject tasks

#### Test: Approve Scope

**Endpoint:** `POST /projects/:contractAddress/approve_scope`

**Only client can call this.**

**Request:**
```bash
curl -X POST http://localhost:4000/projects/5EYCAe5i.../approve_scope \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "approved_task_ids": [1, 2, 3]
  }'
```

**Selective approval example:**
```json
{
  "approved_task_ids": [1, 3]  // Rejects task 2
}
```

**Response:**
```json
{
  "success": true,
  "transactionHash": "0x...",
  "blockHash": "0x...",
  "blockNumber": "12355"
}
```

**What happens:**
1. Client approves specific tasks
2. Non-approved tasks are rejected
3. Total cost recalculated based on approved tasks
4. Advance payment released (if escrow funded)
5. Status updates to `ScopeAccepted`

#### Test: Query Tasks

**Get all tasks:**
```bash
curl "http://localhost:4000/projects/5EYCAe5i.../get_all_tasks"
```

**Response:**
```json
{
  "success": true,
  "response": [
    {
      "id": 1,
      "complexity": { "type": "Days", "value": 5 },
      "cost": "1000",
      "dependencies": [],
      "status": { "type": "Approved" }
    },
    {
      "id": 2,
      "complexity": { "type": "Days", "value": 3 },
      "cost": "800",
      "dependencies": [1],
      "status": { "type": "Rejected" }
    },
    {
      "id": 3,
      "complexity": { "type": "Days", "value": 2 },
      "cost": "500",
      "dependencies": [],
      "status": { "type": "Approved" }
    }
  ]
}
```

**Get specific task:**
```bash
curl "http://localhost:4000/projects/5EYCAe5i.../get_task?task_id=1"
```

#### Test: Complete Task (Milestone Payout)

**Endpoint:** `POST /projects/:contractAddress/complete_task`

**Only client can call this.**

**Request:**
```bash
curl -X POST http://localhost:4000/projects/5EYCAe5i.../complete_task \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": 1
  }'
```

**Response:**
```json
{
  "success": true,
  "transactionHash": "0x...",
  "blockHash": "0x...",
  "blockNumber": "12360"
}
```

**What happens:**
1. Verifies all dependencies completed
2. Marks task as completed
3. Releases payment for this milestone
4. Updates `paid_amount` in project

**Verification:**
```bash
curl "http://localhost:4000/projects/5EYCAe5i.../get_task_completion_status?task_id=1"
```

**Response:**
```json
{
  "success": true,
  "response": {"type": "Completed"}
}
```

#### Test: Mark Project Completed (Final Payout + Ratings)

**Endpoint:** `POST /projects/:contractAddress/mark_completed`

**Only client can call after all tasks completed.**

**Request:**
```bash
curl -X POST http://localhost:4000/projects/5EYCAe5i.../mark_completed \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "ratings": [
      ["5FHneW46...", 9],
      ["5DAAnrj7...", 8]
    ]
  }'
```

**Rating scale:** 0-10
- 0-3: Poor
- 4-6: Average
- 7-8: Good
- 9-10: Excellent

**Response:**
```json
{
  "success": true,
  "transactionHash": "0x...",
  "blockHash": "0x...",
  "blockNumber": "12365"
}
```

**What happens:**
1. Verifies all tasks completed
2. Stores ratings for each team member
3. Releases final payment
4. Updates status to `Completed`
5. Ratings stored for reputation tracking

**Verification:**
```bash
curl "http://localhost:4000/projects/5EYCAe5i.../get_team"
```

**Response shows ratings:**
```json
{
  "success": true,
  "response": [
    {
      "account_id": "5FHneW46...",
      "role": {"type": "Backend"},
      "rating": 9
    },
    {
      "account_id": "5DAAnrj7...",
      "role": {"type": "Frontend"},
      "rating": 8
    }
  ]
}
```

---

## Complete End-to-End Flow

This section provides a complete, executable test that covers the entire project lifecycle.

### Prerequisites

```bash
# Start infrastructure
./infrastructure/up.sh

# Wait for services (30-60 seconds)
./infrastructure/logs.sh zombienet | grep "Chain ready"
```

### Step-by-Step Flow

#### 1. Register Users

```bash
# Using the Virto SDK in tests
# See packages/adapter-api/test/projects.e2e-spec.ts for full example

# Register Client
userId_client="client-$(date +%s)@example.com"

# Register Workers (3 developers)
userId_worker1="worker1-$(date +%s)@example.com"
userId_worker2="worker2-$(date +%s)@example.com"
userId_worker3="worker3-$(date +%s)@example.com"
```

#### 2. Deploy Calendar Contract

```bash
calendar_address=$(curl -X POST http://localhost:4000/calendar/deploy/v5 \
  -H "Authorization: Bearer $token_client" \
  -s | jq -r '.address')

echo "Calendar: $calendar_address"
```

#### 3. Register Workers in Calendar

```bash
# Register all 3 workers
curl -X POST http://localhost:4000/calendar/$calendar_address/register_worker \
  -H "Authorization: Bearer $token_worker1" \
  -d "{\"worker\": \"$address_worker1\"}"

curl -X POST http://localhost:4000/calendar/$calendar_address/register_worker \
  -H "Authorization: Bearer $token_worker2" \
  -d "{\"worker\": \"$address_worker2\"}"

curl -X POST http://localhost:4000/calendar/$calendar_address/register_worker \
  -H "Authorization: Bearer $token_worker3" \
  -d "{\"worker\": \"$address_worker3\"}"
```

#### 4. Set Availability

```bash
# Worker 1: Full-time (coordinator candidate)
curl -X POST http://localhost:4000/calendar/$calendar_address/set_availability \
  -H "Authorization: Bearer $token_worker1" \
  -d '{"availability": {"type": "WeeklyHours", "value": 40}}'

# Worker 2: Full-time (team member)
curl -X POST http://localhost:4000/calendar/$calendar_address/set_availability \
  -H "Authorization: Bearer $token_worker2" \
  -d '{"availability": {"type": "WeeklyHours", "value": 40}}'

# Worker 3: Part-time (team member)
curl -X POST http://localhost:4000/calendar/$calendar_address/set_availability \
  -H "Authorization: Bearer $token_worker3" \
  -d '{"availability": {"type": "WeeklyHours", "value": 20}}'
```

#### 5. Deploy Project Contract

```bash
project_address=$(curl -X POST http://localhost:4000/projects/deploy/v5 \
  -H "Authorization: Bearer $token_client" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Web3 DApp Development\",
    \"dao_address\": \"$address_client\",
    \"calendar_contract\": \"$calendar_address\"
  }" \
  -s | jq -r '.address')

echo "Project: $project_address"
```

#### 6. Assign Coordinator (Automatic Matching)

```bash
curl -X POST http://localhost:4000/projects/$project_address/assign_coordinator \
  -H "Authorization: Bearer $token_client"

# Verify
curl "http://localhost:4000/projects/$project_address/get_project_info" \
  | jq '.response[3]'  # Shows coordinator address
```

**Algorithm selects:** Worker 1 (first available with highest availability)

#### 7. Assign Team (Automatic Matching)

```bash
curl -X POST http://localhost:4000/projects/$project_address/assign_team \
  -H "Authorization: Bearer $token_coordinator" \
  -d '{"_team_size": 2}'

# Verify team
curl "http://localhost:4000/projects/$project_address/get_team" | jq '.'
```

**Algorithm selects:** Worker 2 and Worker 3 (available, excluding coordinator)

#### 8. Propose Scope (Coordinator)

```bash
curl -X POST http://localhost:4000/projects/$project_address/propose_scope \
  -H "Authorization: Bearer $token_coordinator" \
  -H "Content-Type: application/json" \
  -d '{
    "tasks": [
      [1, {"type": "Days", "value": 10}, 5000, []],
      [2, {"type": "Days", "value": 8}, 4000, [1]],
      [3, {"type": "Days", "value": 5}, 2500, []],
      [4, {"type": "Days", "value": 3}, 1500, [2, 3]]
    ],
    "advance_payment_percentage": 25,
    "document_hash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  }'

# Verify tasks
curl "http://localhost:4000/projects/$project_address/get_all_tasks" | jq '.'
```

**Proposed:**
- Task 1: Backend API (10 days, 5000 units)
- Task 2: Frontend UI (8 days, 4000 units, depends on Task 1)
- Task 3: Smart Contracts (5 days, 2500 units)
- Task 4: Testing & Deployment (3 days, 1500 units, depends on Tasks 2 & 3)
- **Total:** 13,000 units
- **Advance:** 25% = 3,250 units

#### 9. Approve Scope (Client)

```bash
curl -X POST http://localhost:4000/projects/$project_address/approve_scope \
  -H "Authorization: Bearer $token_client" \
  -d '{"approved_task_ids": [1, 2, 3, 4]}'

# Verify project info
curl "http://localhost:4000/projects/$project_address/get_project_info" | jq '.'
```

**Status:** `ScopeAccepted`
**Escrow funded:** Client should transfer 13,000 units to contract

#### 10. Complete Tasks (Milestones)

```bash
# Complete Task 1 (Backend API)
curl -X POST http://localhost:4000/projects/$project_address/complete_task \
  -H "Authorization: Bearer $token_client" \
  -d '{"task_id": 1}'

# Wait for Task 1, then complete Task 3 (parallel)
curl -X POST http://localhost:4000/projects/$project_address/complete_task \
  -H "Authorization: Bearer $token_client" \
  -d '{"task_id": 3}'

# Complete Task 2 (depends on Task 1)
curl -X POST http://localhost:4000/projects/$project_address/complete_task \
  -H "Authorization: Bearer $token_client" \
  -d '{"task_id": 2}'

# Complete Task 4 (depends on Tasks 2 & 3)
curl -X POST http://localhost:4000/projects/$project_address/complete_task \
  -H "Authorization: Bearer $token_client" \
  -d '{"task_id": 4}'

# Verify all completed
curl "http://localhost:4000/projects/$project_address/get_all_tasks" \
  | jq '.response[] | {id, status}'
```

**Payouts released:**
- After Task 1: 5,000 units
- After Task 2: 4,000 units
- After Task 3: 2,500 units
- After Task 4: 1,500 units

#### 11. Mark Project Completed (Ratings)

```bash
curl -X POST http://localhost:4000/projects/$project_address/mark_completed \
  -H "Authorization: Bearer $token_client" \
  -H "Content-Type: application/json" \
  -d "{
    \"ratings\": [
      [\"$address_worker1\", 10],
      [\"$address_worker2\", 9],
      [\"$address_worker3\", 8]
    ]
  }"

# Verify final state
curl "http://localhost:4000/projects/$project_address/get_project_info" | jq '.'
curl "http://localhost:4000/projects/$project_address/get_team" | jq '.'
```

**Final State:**
- Status: `Completed`
- Total cost: 13,000 units
- Paid amount: 13,000 units
- Ratings recorded for reputation

---

## API Reference with Examples

### Adapter API Endpoints

Base URL: `http://localhost:4000`

#### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/auth/check-registered/:userId` | Check if user registered | No |
| POST | `/auth/custom-register` | Register new user | No |
| POST | `/auth/custom-connect` | Connect existing user | No |
| POST | `/auth/sign` | Sign transaction | Yes (Bearer) |

#### Calendar

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/calendar/deploy/v5` | Deploy calendar contract | Yes |
| POST | `/calendar/:address/register_worker` | Register worker | Yes |
| POST | `/calendar/:address/set_availability` | Set worker availability | Yes |
| GET | `/calendar/:address/get_availability_hours` | Query worker hours | No |
| GET | `/calendar/:address/get_available_workers` | Get all available workers | No |
| POST | `/calendar/:address/admin_set_worker_availability` | Admin set availability | Yes |

#### Projects

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/projects/deploy/v5` | Deploy project contract | Yes |
| POST | `/projects/:address/assign_coordinator` | Auto-assign coordinator | Yes (DAO) |
| POST | `/projects/:address/assign_team` | Auto-assign team | Yes (Coordinator) |
| POST | `/projects/:address/propose_scope` | Propose milestones | Yes (Coordinator) |
| POST | `/projects/:address/approve_scope` | Approve milestones | Yes (Client) |
| POST | `/projects/:address/complete_task` | Complete milestone | Yes (Client) |
| POST | `/projects/:address/mark_completed` | Mark project done + ratings | Yes (Client) |
| GET | `/projects/:address/get_project_info` | Get project details | No |
| GET | `/projects/:address/get_team` | Get team members | No |
| GET | `/projects/:address/get_all_tasks` | Get all tasks | No |
| GET | `/projects/:address/get_task?task_id=<id>` | Get specific task | No |

---

## Troubleshooting

### Infrastructure Issues

**Problem:** Zombienet not starting
```bash
# Check logs
./infrastructure/logs.sh zombienet

# Common issues:
# - Port 21000 already in use
lsof -i :21000
kill -9 <PID>

# - Docker resources exhausted
docker system prune -a
```

**Problem:** Contracts API not connecting
```bash
# Verify Zombienet is healthy
curl -X POST http://localhost:21000 \
  -d '{"id":1, "jsonrpc":"2.0", "method": "system_health"}'

# Restart contracts-api
docker-compose -f infrastructure/docker-compose.dev.yml restart contracts-api
```

### Test Failures

**Problem:** "User not registered"
```bash
# Clear virto-api database
docker-compose -f infrastructure/docker-compose.dev.yml down
docker volume rm backend_virto-api-data
./infrastructure/up.sh
```

**Problem:** "Insufficient funds"
```bash
# Check balances
curl "http://localhost:21000" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "system_account", "params": ["<address>"]}'

# Virto-api auto-funds on registration, verify logs
./infrastructure/logs.sh virto-api | grep "transfer"
```

**Problem:** "Transaction failed"
```bash
# Check dispatch errors in response
{
  "dispatchError": {
    "type": "Module",
    "value": {
      "index": 8,
      "error": 5
    }
  }
}

# Decode error: contracts-api logs show details
./infrastructure/logs.sh contracts-api
```

### Common Error Codes

| Error | Cause | Solution |
|-------|-------|----------|
| `E_JWT_EXPIRED` | Token expired (>10min) | Call `/auth/custom-connect` again |
| `E_SESSION_NOT_FOUND` | Session cleared | Re-register user |
| `NotAuthorized` | Wrong caller for method | Verify caller role (client/coordinator) |
| `CoordinatorNotAssigned` | Coordinator not set | Call `assign_coordinator` first |
| `TasksNotCompleted` | Trying to mark complete | Complete all tasks first |
| `InvalidRatingValue` | Rating not 0-10 | Use valid rating range |

---

## Running Automated Tests

The project includes comprehensive E2E tests that cover the complete flow.

```bash
# Start infrastructure
./infrastructure/up.sh

# Run all E2E tests
cd packages/adapter-api
npm run test:e2e:all

# Run specific test suites
npm run test:e2e:auth       # Authentication only
npm run test:e2e:calendar   # Calendar only
npm run test:e2e            # Projects (complete flow)
```

**Test output:**
```
Projects Module E2E Tests
  Complete flow: Auth + Projects
    Authentication - Registration and Connection
      ✓ should register a new user (2341ms)
      ✓ should connect user and obtain token (1823ms)
    Deploy Calendar Contract
      ✓ should deploy a new calendar contract (4521ms)
    Calendar - Worker Registration
      ✓ should register a worker in the calendar (1934ms)
    Calendar - Set Availability
      ✓ should set availability (1876ms)
    Projects Module - Deploy Contract
      ✓ should deploy a new project contract (4329ms)
    Projects Module - Assign Coordinator
      ✓ should assign coordinator to project (2187ms)
    Projects Module - Assign Team
      ✓ should assign a team to the project (2456ms)
    Projects Module - Propose Scope
      ✓ should propose a scope with tasks (2103ms)
    Projects Module - Approve Scope
      ✓ should approve scope tasks (1987ms)
    Projects Module - Queries
      ✓ should get project information (234ms)
      ✓ should get all tasks (189ms)
      ✓ should get specific task information (task 1) (201ms)
      ✓ should get team information (198ms)

  14 passing (28s)
```

---

## Additional Resources

- **Virto SDK Documentation**: https://github.com/virto-network/virto-sdk
- **Polkadot API**: https://papi.how
- **Ink! Smart Contracts**: https://use.ink
- **Substrate Documentation**: https://docs.substrate.io

---

## Support

For issues or questions:
1. Check logs: `./infrastructure/logs.sh <service>`
2. Review this guide's troubleshooting section
3. Inspect contract metadata: `backend/packages/contracts-api/.papi/contracts/`
4. Review E2E tests: `backend/packages/adapter-api/test/`

---

**Document Version:** 1.0.0  
**Last Updated:** 2025-10-27  
**Milestone:** 1 - PoC Development
