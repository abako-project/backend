# External Skills and Roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `mock-api` the sole owner of skill and role catalogs, relationships, and user qualifications while `adapter-api` stores only non-qualification profile metadata.

**Architecture:** Automatic matching stays inside `mock-api` and reads its own `worker_skills`, `user_roles`, and availability tables. Adapter profile reads compose local metadata with live mock qualifications; profile updates write qualifications to the mock. The adapter skill table and developer qualification columns are deleted. Outside mock mode, these gateway operations return `501` until a smart-contract provider replaces the mock.

**Tech Stack:** NestJS, TypeORM, Express, better-sqlite3, Jest, Supertest, pnpm.

## Global Constraints

- `mock-api` is the only current source of truth for skills, roles, relationships, and user qualification assignments.
- The future smart contract replaces the mock directly; no adapter mirror is introduced.
- Preserve coordinator authorization: normal profile updates replace selectable roles and preserve role ID `1`.
- Keep project assignment selection inside the mock/contract provider.
- Keep SDK versions, production contracts, and production authentication unchanged.
- There is no production database to preserve; remove obsolete adapter schema now.
- Preserve the unrelated `.gitignore` modification and never stage it.

---

### Task 1: Add mock-owned user qualifications

**Files:**

- Modify: `packages/mock-api/src/worker-registry.ts`
- Modify: `packages/mock-api/src/roles.ts`
- Modify: `packages/mock-api/src/contracts-mock.ts`
- Modify: `packages/mock-api/src/smoke-test.ts`

**Interfaces:**

- `GET /mock/users/:userId/qualifications`
  - response `{ skillIds: number[], roleIds: number[] }`.
- `PUT /mock/users/:userId/qualifications`
  - body `{ skillIds: number[], roleIds: number[] }`;
  - replaces worker skills and selectable roles;
  - preserves coordinator eligibility.

- [ ] **Step 1: Add failing mock smoke coverage**

Add tests that:

1. read Carol's seeded skill and role IDs;
2. replace a test user's skills and selectable roles;
3. verify `GET /mock/workers` and `GET /api/users/:userId/roles` expose the new matching state;
4. verify coordinator role ID `1` survives a normal qualification replacement;
5. reject unknown users, invalid/duplicate/unknown skills, and invalid/duplicate/non-selectable roles;
6. snapshot qualifications before an invalid update and prove neither side changes.

Run:

```bash
MOCK_SQLITE_PATH=:memory: pnpm --filter mock-api test
```

Expected: the new qualification endpoint tests fail with `404`.

- [ ] **Step 2: Make worker skill replacement strict**

In `WorkerRegistry.setWorkerSkills`:

- require an array;
- require positive integer IDs;
- reject duplicates;
- verify every skill exists before deleting current rows;
- allow an empty array to represent no skills;
- return IDs sorted ascending.

Add a lookup that returns a worker's skill IDs by wallet address. Make `upsertWorker` accept optional `userId` and `name` so calendar registration can preserve existing metadata.

Use the existing `SkillError` status mapping for `400` failures.

- [ ] **Step 3: Expose qualification replacement in RoleRegistry**

Reuse `setRegistrationRoles`; it already:

- validates a non-empty unique array of selectable role IDs;
- replaces non-coordinator roles;
- preserves coordinator role ID `1`.

Only expose the minimum validation/mutation surface needed by the combined mock route. Do not add another role storage abstraction.

- [ ] **Step 4: Implement the combined qualification endpoints**

In `contracts-mock.ts`:

1. resolve the user from `store.users`;
2. use the mock-owned wallet address;
3. return current worker skill IDs and all current role IDs for `GET`;
4. validate both arrays before mutation;
5. execute role and worker updates in one `registryDatabase.transaction`;
6. create the worker registry row when the authenticated mock user does not yet have one;
7. return the stored IDs after `PUT`.

Map `RoleError` and `SkillError` statuses without converting them to `500`.

- [ ] **Step 5: Stop calendar registration from importing adapter qualifications**

For `register_worker` and `register_workers` in `contracts-mock.ts`:

- derive `userId` with `store.getUserByAddress`;
- call `upsertWorker` without `skillIds`;
- never clear or replace existing worker skills.

Add a smoke test that sets qualifications, registers the worker in a calendar, and verifies they are unchanged.

- [ ] **Step 6: Run mock tests**

```bash
MOCK_SQLITE_PATH=:memory: pnpm --filter mock-api test
```

Expected: all mock smoke tests pass.

- [ ] **Step 7: Commit the task**

```bash
git add packages/mock-api/src/worker-registry.ts packages/mock-api/src/roles.ts packages/mock-api/src/contracts-mock.ts packages/mock-api/src/smoke-test.ts
git commit -m "feat: store user qualifications in mock"
```

---

### Task 2: Remove the adapter skill and profile qualification schema

**Files:**

- Delete: `packages/adapter-api/src/database/entities/skill.entity.ts`
- Modify: `packages/adapter-api/src/database/entities/index.ts`
- Modify: `packages/adapter-api/src/database/database.module.ts`
- Modify: `packages/adapter-api/src/database/entities/developer.entity.ts`
- Modify: `packages/adapter-api/src/modules/skills/skills.module.ts`
- Modify: `packages/adapter-api/src/modules/skills/skills.service.ts`
- Modify: `packages/adapter-api/src/modules/seed/seed.module.ts`
- Modify: `packages/adapter-api/src/modules/seed/seed.service.ts`
- Create: `packages/adapter-api/test/skills.service.spec.ts`
- Modify: `packages/adapter-api/test/projects-happy-path.e2e-spec.ts`

- [ ] **Step 1: Add failing schema and non-mock tests**

In `projects-happy-path.e2e-spec.ts`, use the TypeORM `DataSource` to assert:

```ts
const skillTables = await dataSource.query(
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'skills'",
);
expect(skillTables).toEqual([]);

const developerColumns = await dataSource.query('PRAGMA table_info(developers)');
expect(developerColumns.map(({ name }: { name: string }) => name))
  .not.toEqual(expect.arrayContaining(['skills', 'role']));
```

Create `test/skills.service.spec.ts` and assert that catalog and qualification methods throw `NotImplementedException` when `USE_MOCK_AUTH` is not `true`.

Run the focused test and the integration suite. Expected: schema assertions fail because all three local fields still exist.

- [ ] **Step 2: Delete the local skill catalog**

- delete `skill.entity.ts`;
- remove its barrel export;
- remove `Skill` from `DatabaseModule`;
- remove `TypeOrmModule.forFeature([Skill])` from `SkillsModule`;
- remove `Skill` from `SeedModule`;
- remove every `Repository<Skill>` injection and local repository branch.

`SkillsService` keeps only mock gateway behavior and a single non-mock `501` guard.

- [ ] **Step 3: Delete local developer qualification columns**

Remove `skills` and free-text `role` from the TypeORM `Developer` entity. Do not replace them with `skillIds` or `roleIds`.

TypeORM `synchronize` will clean current dev/test SQLite databases; no migration is added.

- [ ] **Step 4: Keep seed requirement resolution external**

In `SeedService`:

- obtain the mock skill catalog through `SkillsService.findAll`;
- retain the name-to-ID map only for milestone requirement payloads;
- remove `role` and `skills` from every seeded developer row.

The mock seed remains responsible for worker skills and user roles.

- [ ] **Step 5: Implement qualification gateway methods**

In `SkillsService`, add:

```ts
type UserQualifications = {
  skillIds: number[];
  roleIds: number[];
};

getUserQualifications(userId: string): Promise<UserQualifications>;
replaceUserQualifications(
  userId: string,
  skillIds: number[],
  roleIds: number[],
): Promise<UserQualifications>;
```

Both delegate to `/mock/users/:userId/qualifications` in mock mode and return `501` otherwise.

Keep `resolveReferences` for numeric IDs and free-form names, but never persist its result locally. Allow submitted `roleIds` to be used when associating newly created skill names.

- [ ] **Step 6: Run focused checks**

```bash
pnpm --filter abako-adapter test -- --runInBand test/skills.service.spec.ts
pnpm --filter abako-adapter build
```

Expected: focused tests and TypeScript pass.

- [ ] **Step 7: Commit the task**

```bash
git add packages/adapter-api/src/database packages/adapter-api/src/modules/skills packages/adapter-api/src/modules/seed packages/adapter-api/test/skills.service.spec.ts packages/adapter-api/test/projects-happy-path.e2e-spec.ts
git commit -m "refactor: remove adapter qualification storage"
```

---

### Task 3: Compose developer profiles from adapter and mock data

**Files:**

- Modify: `packages/adapter-api/src/modules/developers/types.ts`
- Modify: `packages/adapter-api/src/modules/developers/developers.service.ts`
- Modify: `packages/adapter-api/src/modules/developers/developers.controller.ts`
- Modify: `packages/adapter-api/src/modules/calendar/calendar.module.ts`
- Modify: `packages/adapter-api/src/modules/calendar/calendar.service.ts`
- Modify: `packages/adapter-api/test/projects-happy-path.e2e-spec.ts`
- Modify: `packages/adapter-api/test/developers.spec.ts`

- [ ] **Step 1: Add failing profile composition tests**

Extend adapter tests to prove:

- `GET /v1/developers/:developerId` returns `skills` and `roleIds` read from the mock;
- `GET /v1/developers` does the same for each returned profile;
- `PUT /v1/developers/:developerId` accepts `skills` and required `roleIds`;
- a subsequent direct mock qualification read returns the updated values;
- a subsequent profile read reflects direct mock changes without touching adapter SQLite;
- invalid external qualification updates do not save local qualification data.

Keep `skills` as the existing ID array for response compatibility. Remove the free-text `role` response and add `roleIds`.

- [ ] **Step 2: Update developer request and response types**

- remove free-text `role`;
- keep `skills: Array<number | string>` on update;
- add required `roleIds: number[]` on update;
- define a composed profile response with `skills: number[]` and `roleIds: number[]`;
- keep the database entity type free of both fields.

Update Swagger examples accordingly.

- [ ] **Step 3: Compose profile reads**

Add one private enrichment helper in `DevelopersService`:

1. obtain the stable `userId` with email fallback;
2. call `SkillsService.getUserQualifications`;
3. return `{ ...developer, skills: skillIds, roleIds }`.

Use it in `findAll` and `getWithRelations`. Keep internal identity lookups local.

- [ ] **Step 4: Route profile qualification updates to mock**

In `DevelopersService.update`:

1. load the local developer;
2. derive its user identifier;
3. resolve submitted skill references using the submitted selectable roles;
4. call `replaceUserQualifications`;
5. save only the non-qualification fields locally.

Do not assign `developer.skills` or `developer.role`.

The existing coordinator-eligibility endpoint remains the only way to add or remove role ID `1`.

- [ ] **Step 5: Remove adapter profile data from calendar registration**

Delete `CalendarService.getWorkerProfile`, its `DevelopersService` dependency, and `DevelopersModule` from `CalendarModule`.

Send only worker addresses through `register_worker` and `register_workers`. The mock now resolves identity and qualifications internally.

- [ ] **Step 6: Prove matching uses profile updates immediately**

Update the project happy-path helper so worker setup:

- registers mock authentication roles;
- updates the adapter profile with `roleIds` and `skills`;
- registers the wallet in the calendar without qualification payloads.

Keep the existing role-and-skill matching assertions. Their success proves that the profile update changed mock storage and that calendar registration did not overwrite it.

- [ ] **Step 7: Run adapter and integration tests**

```bash
pnpm --filter abako-adapter build
MOCK_SQLITE_PATH=:memory: pnpm run test:mock
```

Expected: adapter build and the full integration suite pass.

- [ ] **Step 8: Commit the task**

```bash
git add packages/adapter-api/src/modules/developers packages/adapter-api/src/modules/calendar packages/adapter-api/test/projects-happy-path.e2e-spec.ts packages/adapter-api/test/developers.spec.ts
git commit -m "feat: compose profiles with mock qualifications"
```

---

### Task 4: Document and verify the final boundary

**Files:**

- Modify: `README.md`
- Modify: `packages/adapter-api/README.md`
- Modify: `packages/adapter-api/docs/project-happy-path-e2e-flow.md`

- [ ] **Step 1: Update documentation**

Document:

- mock/contract ownership of catalogs and user qualifications;
- removal of all adapter skill and role storage;
- profile read composition and update delegation;
- `skills` and `roleIds` profile payloads;
- automatic assignment inside the mock/contract;
- calendar registration preserving provider-owned qualifications;
- current non-mock `501` behavior and future direct contract replacement.

- [ ] **Step 2: Run complete verification**

```bash
MOCK_SQLITE_PATH=:memory: pnpm --filter mock-api test
pnpm --filter abako-adapter build
MOCK_SQLITE_PATH=:memory: pnpm run test:mock
git diff --check
```

Expected:

- mock smoke passes;
- adapter build exits `0`;
- full integration passes;
- `git diff --check` exits `0`.

- [ ] **Step 3: Review scope and commit**

Confirm:

- no generated SQLite files are present;
- no adapter `Skill` entity, skill table, or developer qualification column remains;
- `.gitignore` remains unstaged;
- matching code still reads only mock registries.

Then commit only documentation:

```bash
git add README.md packages/adapter-api/README.md packages/adapter-api/docs/project-happy-path-e2e-flow.md
git commit -m "docs: define external qualification ownership"
```
