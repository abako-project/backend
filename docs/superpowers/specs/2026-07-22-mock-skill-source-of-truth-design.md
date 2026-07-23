# External skill catalog as the source of truth

## Scope

`adapter-api` never owns or mirrors the skill catalog, the role catalog, or their relationships.

During mock/dev work, `mock-api` is the only source of truth. When the production smart contract exists, it replaces `mock-api` as the only source of truth. The adapter remains the public gateway in both cases.

Developer profiles remain stored in `adapter-api` and keep only skill IDs. Authentication, matching, availability, projects, and profile ownership are otherwise unchanged.

## Data ownership

- Today, `mock-api` owns skill and role IDs, names, categories, and skill-role relationships.
- In production, the smart contract will own the same data.
- `adapter-api` developer profiles store `skillIds: number[]` as external references.
- `adapter-api` does not synchronize, cache, read, seed, or write a local skill or role catalog.
- The historical adapter `skills` table may remain physically present to avoid a destructive schema change in this issue. It is not part of any application flow and will be removed by a separate explicit migration.

## Adapter routing

The public routes stay stable while their backing provider changes:

| Runtime | Catalog provider |
|---|---|
| `USE_MOCK_AUTH=true` | `mock-api` |
| Production after contract integration | Smart contract |
| Production before contract integration | `501 Not Implemented` |

Until the contract exists, every adapter operation that needs skill or role catalog data returns `501` outside mock mode. There is no local fallback.

In mock mode:

- `GET /v1/skills` proxies the mock catalog while preserving `{ skills: Skill[] }`.
- `POST /v1/skills` creates or updates the skill in `mock-api` and returns the mock-owned ID.
- `GET /v1/skills/ids` and `GET /v1/skills/:skillId` delegate to `mock-api`.
- Profile skill IDs and names are resolved against the mock catalog only.
- A new free-form profile skill is created in `mock-api` with the profile user's registered role IDs; only the returned ID is stored on the profile.
- Numeric strings received from multipart profile forms are treated as skill IDs and validated against `mock-api`.

Future contract integration replaces these mock calls; it does not introduce a synchronization step or a second catalog.

## Seed behavior

Adapter demo seed runs only in mock mode. It reads the already-seeded mock catalog, builds its name-to-ID map from that response, and stores those IDs in developer and milestone records. It never inserts skill rows into the adapter database.

Outside mock mode, adapter demo seed is skipped until the contract-backed seed flow is designed.

## Errors

- Unknown numeric skill IDs are rejected with `400`.
- Creating a free-form profile skill requires a mock user with at least one registered role; otherwise the profile update returns `400`.
- Mock transport errors retain their upstream HTTP status.
- Catalog-dependent operations return `501` outside mock mode until the smart contract integration exists.

## Verification

Coverage must prove that:

- the historical adapter skill table receives no seed, create, update, or profile writes;
- list, create, ID lookup, and role filtering still work through the adapter;
- profile updates validate existing IDs against the mock catalog;
- free-form profile skills are created in the mock and their IDs are stored on profiles;
- non-mock catalog and validation operations return `501`;
- existing project matching and profile tests remain green.
