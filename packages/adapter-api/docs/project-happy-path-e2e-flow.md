# Project happy path E2E flow

This document describes the issue #60 happy path covered by
`packages/adapter-api/test/projects-happy-path.e2e-spec.ts`.

It is written for frontend integration work. The API flow below is the current
mock-backed behavior. Some product and ledger details are intentionally called
out as pending definitions so they can be implemented consistently later.

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
        | POST /ratings/deploy/v5              (mock direct)
        | POST /calendar/deploy/v5             (mock direct)
        | POST /v1/calendar/:calendar/register_workers
        | POST /v1/calendar/:calendar/set_availability
        | POST /api/fund                       (mock direct)
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

1. Register or connect the client, workers, and coordinators.
2. Create the client profile with `/v1/clients`.
3. Create each developer profile with `/v1/developers`, update it with skills
   and availability metadata, then mark two developers as coordinator-eligible.
4. Register workers in the chosen calendar:

```http
POST /v1/calendar/:calendarContract/register_workers
Authorization: Bearer <token>

{
  "workers": ["5...", "5..."]
}
```

5. Set worker availability. In the E2E, available workers get enough time and
   unavailable workers get zero weekly hours:

```http
POST /v1/calendar/:calendarContract/set_availability
Authorization: Bearer <worker-token>

{
  "availability": { "type": "PermanentWeeklyHours", "value": 20 }
}
```

6. Fund the client in mock mode:

```http
POST /api/fund

{
  "address": "5...",
  "amount": "1000000",
  "assetId": 1
}
```

7. Client creates the project:

```http
POST /v1/projects/deploy/v5
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
GET /v1/projects/:projectId/get_project_info
```

Expected state:

- `creationStatus: "created"`
- `contractAddress` is set
- `consultantId` points to one of the coordinator developers

8. Coordinator proposes scope:

```http
POST /v1/projects/:projectId/propose_scope
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
        { "assignmentKey": "backend", "hours": 20, "skillIds": [1] }
      ]
    }
  ]
}
```

The real E2E sends four milestones with 5/3/4/2 requirements.

9. Client approves the full scope:

```http
POST /v1/projects/:projectId/approve_scope
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
POST /v1/projects/:projectId/submit_task_for_review
Authorization: Bearer <coordinator-token>

{ "task_id": 101 }
```

Client accepts the milestone:

```http
POST /v1/projects/:projectId/complete_task
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
POST /v1/projects/:projectId/mark_completed
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
POST /v1/projects/:projectId/submit_coordinator_ratings
Authorization: Bearer <coordinator-token>

{
  "clientRating": 9,
  "teamRatings": [["5WorkerAddress", 8]]
}
```

13. A worker rates the coordinator:

```http
POST /v1/projects/:projectId/submit_developer_rating
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
GET /v1/projects/:projectId/get_project_info
GET /v1/projects/:projectId/get_all_tasks
GET /v1/projects/:projectId/get_team
GET /v1/calendar/:calendarContract/get_all_workers_availability
GET /v1/ratings/project/:projectId
GET /v1/ratings/developer/:developerId
GET /api/balance?address=5...&assetId=1
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
