# Mock skill catalog as the source of truth

## Scope

In mock mode, `mock-api` is the only source of truth for skills and skill-role relationships. Developer profiles remain stored in `adapter-api` and keep only skill IDs. Authentication, roles, matching, availability, projects, and profile ownership are unchanged.

Outside mock mode, the existing adapter skill table and legacy behavior remain available until a production smart contract provides the catalog.

## Data ownership

- `mock-api` owns skill IDs, names, categories, and role relationships.
- `adapter-api` developer profiles store `skillIds: number[]` as references.
- `adapter-api` must not read or write its local skill table while mock mode is enabled.
- The local `Skill` entity remains only for the non-mock legacy path; no schema migration or table deletion is required.

## Adapter behavior in mock mode

- `GET /v1/skills` proxies the mock catalog while preserving `{ skills: Skill[] }`.
- `POST /v1/skills` creates or updates the skill in `mock-api` and returns that response without mirroring it locally.
- `GET /v1/skills/ids` and `GET /v1/skills/:skillId` continue to delegate to `mock-api`.
- Profile skill IDs and names are resolved against the mock catalog only.
- A new free-form profile skill is created in `mock-api` with the profile user's registered role IDs; the returned ID is stored on the profile.
- Numeric strings received from multipart profile forms are treated as skill IDs and validated against `mock-api`.

## Seed behavior

When mock mode is enabled, adapter seed data reads the already-seeded mock catalog and builds its name-to-ID map from that response. It does not insert skills into the adapter database. Developer and milestone seed records continue to store those IDs.

The non-mock seed path continues to create the local legacy catalog.

## Errors

- Unknown numeric skill IDs are rejected with `400`.
- Creating a free-form profile skill requires a mock user with at least one registered role; otherwise the profile update returns `400`.
- Mock transport errors retain their upstream HTTP status.

## Verification

Integration coverage must prove that:

- the adapter local skill table stays empty in mock mode;
- list, create, ID lookup, and role filtering still work through the adapter;
- profile updates validate existing IDs against the mock catalog;
- free-form profile skills are created in the mock and their IDs are stored on profiles;
- the production legacy branch still compiles;
- existing project matching and profile tests remain green.
