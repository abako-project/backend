# Frontend project happy path

This guide describes the mock-backed project lifecycle covered by
`packages/adapter-api/test/projects-happy-path.e2e-spec.ts`.

It is the frontend integration reference for the current behavior. The test is
the executable specification; this document explains the same flow without
requiring frontend developers to read backend test code.

## Base URLs

| Name | Default | Use |
| --- | --- | --- |
| `API` | `http://localhost:4000` | Public adapter endpoints under `/v1` |
| `MOCK` | `http://localhost:4010` | Mock-only test setup such as contract deployment and funding |

Frontend application calls go through `API`. Calls marked **mock setup only**
go directly to `MOCK` and must not become production frontend dependencies.

## Flow at a glance

1. Register and connect users.
2. Create client and developer profiles.
3. Store developer `skills` and `roleIds` through the authenticated profile update.
4. Register worker wallets in the calendar and set availability.
5. Fund the client in mock mode.
6. Create the project and wait for automatic coordinator assignment.
7. Coordinator proposes milestones with role-and-skill requirements.
8. Client approves scope; the mock plans the team and activates milestone one.
9. Coordinator submits each milestone; client accepts it and activates the next.
10. Complete the project and submit ratings.

## Important notes to define and implement

- Scope approval is currently all-or-nothing for the proposed task list.
  Calling `approve_scope` with only one task rejects every still-pending task
  that is not included. If frontend needs milestone-by-milestone approval from
  the first step, that flow still needs to be defined and implemented.
- Escrow is currently advance-only in the mock. `approve_scope` debits the
  client for `advance_payment_percentage` and creates an unreleased advance
  payment to the project contract. Real per-milestone escrow remains pending.
- Milestone payment is currently made when the client accepts the milestone
  with `complete_task`. The payment is debited from the client then. The future
  escrow-backed flow should define when funds are locked and how they are
  released.
- The current mock pays the task `assigned_to` account, which is the first
  assignment in the milestone. Splitting the milestone budget across every
  worker in the `assignments` array remains pending.
- Ranking lists are not implemented yet. Ratings are persisted, and
  `/v1/ratings/developer/:developerId` returns `averageRating` and
  `totalRatings`. The global ranking calculation and exposure remain pending.

## Actors

The E2E creates a fresh isolated world:

- 1 client with enough funded balance.
- 10 worker developers.
- 2 developer coordinators.
- A dedicated mock calendar contract.
- A dedicated mock ratings contract.

Worker availability is part of the scenario. Five workers have enough available
time and five have zero weekly hours. The zero-hour workers have compatible
skills, but must not be selected because they are unavailable.

## Milestone plan

The coordinator proposes four milestones:

| Milestone | Required workers | Assignment keys |
| --- | ---: | --- |
| 1 - Foundation | 5 | backend, frontend, qa, designer, devops |
| 2 - Product Slice | 3 | backend, frontend, qa |
| 3 - Hardening | 4 | backend, frontend, designer, devops |
| 4 - Launch | 2 | backend, qa |

The repeated assignment keys intentionally verify that the assignment algorithm
prefers workers already used in the project when they still have enough
available time.

## API sequence

```text
Client/Workers/Coordinators
        |
        | POST /v1/auth/custom-register
        | POST /v1/auth/custom-connect
        v
Adapter API
        |
        | POST /v1/clients
        | POST /v1/developers
        | PUT  /v1/developers/:id
        | PUT  /v1/developers/:id/coordinator-eligibility
        v
Profiles ready
        |
        | POST /ratings/deploy/v5              (mock setup only)
        | POST /calendar/deploy/v5             (mock setup only)
        | POST /v1/calendar/:calendar/register_workers
        | POST /v1/calendar/:calendar/set_availability
        | POST /api/fund                       (mock setup only)
        v
Calendar + balances ready
        |
        | POST /v1/projects/deploy/v5          (client)
        v
Project deployed
        |
        | mock auto assigns coordinator
        v
Coordinator assigned
        |
        | POST /v1/projects/:projectId/propose_scope
        v
Scope proposed with 4 milestones
        |
        | POST /v1/projects/:projectId/approve_scope
        v
Scope accepted, team planned, milestone 1 active
        |
        | Repeated for each active milestone:
        |   POST /v1/projects/:projectId/submit_task_for_review
        |   POST /v1/projects/:projectId/complete_task
        v
All milestones completed
        |
        | POST /v1/projects/:projectId/mark_completed
        | POST /v1/projects/:projectId/submit_coordinator_ratings
        | POST /v1/projects/:projectId/submit_developer_rating
        v
Project completed and ratings persisted
```

## Frontend flow

1. Register or connect the client, workers, and coordinators. Mock registration
   requires at least one selectable `roleId`; role `1` cannot be self-assigned.
   Keep the bearer token and wallet address returned by the auth flow.
2. Create the client profile with `/v1/clients`.
3. Create each developer profile with `/v1/developers`. Update local metadata
   together with required `skills` and `roleIds`; the adapter writes those
   qualifications to `mock-api`, not its profile database. The update requires
   that developer's bearer token and cannot change `userId`. Then mark two
   developers as coordinator-eligible.

```http
PUT $API/v1/developers/:developerId
Authorization: Bearer <developer-token>
Content-Type: application/json

{
  "userId": "developer@example.com",
  "name": "Frontend Developer",
  "githubUsername": "frontend-dev",
  "bio": "Frontend specialist",
  "background": "Web application delivery",
  "proficiency": "senior",
  "location": "Remote",
  "availability": "WeeklyHours",
  "languages": ["ENG"],
  "skills": [5, 8],
  "roleIds": [2],
  "availableHoursPerWeek": 20
}
```

`skills` may contain existing IDs or free-form names. `roleIds` must contain
selectable role IDs and replaces the user's selectable role set. Coordinator
role `1` is managed only by the coordinator-eligibility endpoint and is
preserved by normal qualification updates.

The mock-only coordinator eligibility helper is:

```http
PUT $API/v1/developers/:developerId/coordinator-eligibility
Content-Type: application/json

{ "isCoordinator": true }
```

4. Register workers in the chosen calendar:

```http
POST $API/v1/calendar/:calendarContract/register_workers
Authorization: Bearer <token>

{
  "workers": ["5...", "5..."]
}
```

Calendar registration copies no role or skill data. The mock resolves the
wallet's user and uses the qualifications already stored in its shared
registry. Future smart-contract mode is expected to use the same ownership
boundary.

The E2E deploys isolated ratings and calendar contracts directly through
`POST $MOCK/ratings/deploy/v5` and `POST $MOCK/calendar/deploy/v5`. A frontend
normally receives these addresses from configuration and does not deploy them.

5. Set worker availability. In the E2E, available workers get enough time and
   unavailable workers get zero weekly hours:

```http
POST $API/v1/calendar/:calendarContract/set_availability
Authorization: Bearer <worker-token>

{
  "availability": { "type": "PermanentWeeklyHours", "value": 20 }
}
```

6. Fund the client in mock mode:

```http
POST $MOCK/api/fund

{
  "address": "5...",
  "amount": "1000000",
  "assetId": 1
}
```

7. Client creates the project:

```http
POST $API/v1/projects/deploy/v5
Authorization: Bearer <client-token>

{
  "title": "Issue 60 Marketplace Build",
  "budget": 14000,
  "deliveryTime": 45,
  "calendarContract": "5...",
  "ratingsContract": "5..."
}
```

Poll:

```http
GET $API/v1/projects/:projectId/get_project_info
```

Expected state:

- `creationStatus: "created"`
- `contractAddress` is set
- `consultantId` points to one of the coordinator developers

8. Coordinator proposes scope:

```http
POST $API/v1/projects/:projectId/propose_scope
Authorization: Bearer <coordinator-token>

{
  "advance_payment_percentage": 10,
  "document_hash": "issue60-doc",
  "milestones": [
    {
      "title": "Milestone 1 - Foundation",
      "budget": 5000,
      "deliveryTime": 10,
      "requirements": [
        { "assignmentKey": "backend", "roleId": 3, "hours": 20, "skillIds": [1] }
      ]
    }
  ]
}
```

The real E2E sends four milestones with 5/3/4/2 requirements.

Each requirement is an assignment slot:

- `assignmentKey` identifies the same responsibility across milestones.
- `roleId` is mandatory and must reference an existing role.
- `hours` is the availability reserved when the milestone becomes active.
- `skillIds` must be a non-empty list of catalog IDs.

Matching runs inside `mock-api`. A worker must own the requested role and every
requested skill and must have enough availability. A skill does not need to be
cataloged under the requested role; skill-role relationships are discovery
metadata only.

9. Client approves the full scope:

```http
POST $API/v1/projects/:projectId/approve_scope
Authorization: Bearer <client-token>

{
  "approved_task_ids": [101, 102, 103, 104]
}
```

Expected:

- `success: true`
- `autoAssignTeam.triggered: true`
- `autoAssignTeam.success: true`
- Client balance decreases by the advance amount.
- First milestone becomes active.
- Active milestone assignments do not include unavailable workers.
- Worker availability decreases by the active milestone assignment hours.

10. For each milestone:

Coordinator requests review:

```http
POST $API/v1/projects/:projectId/submit_task_for_review
Authorization: Bearer <coordinator-token>

{ "task_id": 101 }
```

Client accepts the milestone:

```http
POST $API/v1/projects/:projectId/complete_task
Authorization: Bearer <client-token>

{ "task_id": 101 }
```

Expected after client acceptance:

- The milestone has `completed: true`.
- Client balance decreases by the milestone cost.
- The primary assigned worker balance increases by the milestone cost.
- The next milestone becomes active, unless this was the last milestone.
- Availability decreases when the next milestone is activated.
- No checked balance is negative.

11. Client marks the project completed and rates the team:

```http
POST $API/v1/projects/:projectId/mark_completed
Authorization: Bearer <client-token>

{
  "ratings": [["5WorkerAddress", 8]],
  "coordinatorRating": 9
}
```

Pending definition: `coordinatorRating` is accepted by the endpoint shape, but
the service currently persists only the team ratings from this call. The final
client-to-coordinator rating persistence flow still needs to be defined and
implemented.

12. Coordinator rates client/team:

```http
POST $API/v1/projects/:projectId/submit_coordinator_ratings
Authorization: Bearer <coordinator-token>

{
  "clientRating": 9,
  "teamRatings": [["5WorkerAddress", 8]]
}
```

13. A worker rates the coordinator:

```http
POST $API/v1/projects/:projectId/submit_developer_rating
Authorization: Bearer <worker-token>

{
  "coordinatorRating": 8
}
```

Workers do not rate themselves in this flow. The E2E verifies that the selected
developer rater is not the coordinator and that the project ratings do not
include coordinator self-rating or developer self-rating for that rater.

## Verification endpoints

Use these endpoints in frontend integration tests:

```http
GET $API/v1/projects/:projectId/get_project_info
GET $API/v1/projects/:projectId/get_all_tasks
GET $API/v1/projects/:projectId/get_team
GET $API/v1/calendar/:calendarContract/get_all_workers_availability
GET $API/v1/ratings/project/:projectId
GET $API/v1/ratings/developer/:developerId
GET $MOCK/api/balance?address=5...&assetId=1
```

## What should fail

The E2E is intended to fail if:

- A zero-availability worker is selected for an active milestone.
- Milestone worker counts are not 5, 3, 4, and 2.
- Any checked balance becomes negative.
- A repeated assignment key stops reusing the same worker while that worker
  still has enough availability.
- A worker rates themselves.
- Ratings stop producing `averageRating` and `totalRatings`.
