# External skills and roles as the source of truth

## Scope

`adapter-api` never owns or mirrors skills, roles, their relationships, or their assignment to users.

During mock/dev work, `mock-api` is the only source of truth. When the production smart contract exists, it replaces `mock-api` directly. The adapter remains the public gateway in both cases.

Developer profiles remain in `adapter-api` only for lower-impact metadata such as name, GitHub username, biography, languages, location, and image.

## Assignment ownership

Automatic assignment already runs in the contract provider:

- coordinator selection runs in `mock-api` against its registered workers, coordinator role, and availability;
- team selection runs in `mock-api` against its `worker_skills`, `user_roles`, and availability storage;
- `adapter-api` triggers the operation and stores the returned project assignment for presentation and notifications, but never supplies matching qualifications.

The future smart contract must preserve that boundary and perform matching from its own storage.

## Data ownership

`mock-api` owns:

- the skill catalog;
- the role catalog;
- skill-role relationships;
- each user's assigned skills;
- each user's assigned roles;
- the data used by coordinator and worker matching.

`adapter-api` owns:

- the remaining developer profile fields;
- project proposals and projections, which may reference external skill and role IDs;
- assignment results used for presentation and notifications;
- no catalog rows or user qualification assignments.

## Adapter schema cleanup

There is no deployed production database to preserve, so this issue removes:

- the adapter `Skill` entity and `skills` table;
- the `Developer.skills` column;
- the legacy free-text `Developer.role` column;
- every adapter repository registration, seed, read, and write for those fields.

TypeORM `synchronize` applies this cleanup to the current dev/test databases. No migration is required.

## Profile reads

Profile-facing reads compose two sources:

1. read local profile metadata from `adapter-api`;
2. read the user's current qualifications from `mock-api`;
3. return one profile response.

For compatibility, `skills` remains an array of skill IDs. `roleIds` is added as an array of role IDs. Both arrays are fetched live from `mock-api`, not from adapter storage.

`GET /v1/developers` and `GET /v1/developers/:developerId` use this composition. Internal developer lookups that only need identity or local metadata remain local.

Outside mock mode, profile reads that require qualifications return `501` until the contract provider exists.

## Profile updates

`PUT /v1/developers/:developerId` accepts:

```json
{
  "skills": [2, 5],
  "roleIds": [2, 4]
}
```

The existing free-form skill-name behavior remains available: missing names are created in the mock catalog and associated with the submitted selectable roles.

The adapter sends the resolved skill IDs and role IDs to `mock-api`, then saves only the remaining local profile fields. The mock replaces the user's selectable roles and skills, so subsequent matching sees the new values immediately.

The reserved coordinator role remains controlled by the existing coordinator-eligibility endpoint. A normal profile update preserves it.

Outside mock mode, qualification updates return `501` until the smart contract provider exists.

## Internal mock interface

Add:

- `GET /mock/users/:userId/qualifications`
  - returns `{ skillIds: number[], roleIds: number[] }`;
- `PUT /mock/users/:userId/qualifications`
  - body `{ skillIds: number[], roleIds: number[] }`;
  - validates the registered user, existing skill IDs, positive unique selectable role IDs, and duplicates;
  - replaces user skills and selectable roles;
  - preserves coordinator eligibility.

The update uses the shared registry database so the matching state is changed together.

## Calendar registration

Calendar worker registration must no longer read profile skills from `adapter-api` or send them to `mock-api`.

The mock derives `userId` from its own address registry and preserves qualifications already stored for that worker. Registering a worker in a calendar must never clear or overwrite their skills or roles.

## Seed behavior

- `mock-api` seeds role assignments and worker skills.
- Adapter developer seed records contain only local metadata.
- Adapter project and milestone seeds may read the mock catalog to resolve requirement IDs, but do not persist a catalog or user qualifications.

## Verification

Coverage must prove that:

- adapter SQLite has no `skills` table and no developer `skills` or `role` columns;
- mock qualification reads return seeded worker skills and roles;
- profile reads return live mock-owned `skills` and `roleIds`;
- profile updates change mock storage and immediately affect matching;
- invalid qualification updates do not partially change matching state;
- calendar registration preserves mock-owned qualifications;
- non-mock catalog and qualification operations return `501`;
- existing project assignment and profile behavior remains green.
