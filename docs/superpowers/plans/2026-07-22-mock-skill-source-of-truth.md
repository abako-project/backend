# Mock Skill Source of Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `mock-api` the only source of truth for skills and skill-role relationships in mock mode while developer profiles keep only skill IDs in `adapter-api`.

**Architecture:** `SkillsService` keeps its local TypeORM repository only for the non-mock legacy path. In mock mode every catalog read, write, and validation delegates to `/mock/skills`; adapter seed data obtains the same catalog through `SkillsService` and never inserts local skill rows.

**Tech Stack:** NestJS, TypeORM, Express mock-api, SQLite, Jest, Supertest, pnpm.

## Global Constraints

- Developer profiles remain stored in `adapter-api` and keep `skills: number[]`.
- `mock-api` owns skill IDs, names, categories, and role relationships in mock mode.
- `adapter-api` must not read or write its local skill table while mock mode is enabled.
- Keep the local `Skill` entity and non-mock legacy behavior; do not add a schema migration.
- Keep SDK versions, production contracts, production authentication, and deployed databases unchanged.
- Preserve the unrelated `.gitignore` modification and never stage it.

---

### Task 1: Stop mirroring mock skill operations locally

**Files:**
- Modify: `packages/adapter-api/test/projects-happy-path.e2e-spec.ts:1-149,331-424`
- Modify: `packages/adapter-api/src/modules/skills/skills.service.ts:1-239`

**Interfaces:**
- Consumes: `GET /mock/skills`, `POST /mock/skills`, `GET /mock/skills/:id`, and the existing `Skill` repository for non-mock mode only.
- Produces: `SkillsService.findAll(): Promise<CatalogSkill[]>` and mock create/resolve operations that return mock-owned IDs without local persistence.

- [ ] **Step 1: Add repository access and a no-local-write assertion to the existing E2E test**

Add the imports and test repository:

```ts
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Skill as SkillEntity } from '../src/database/entities/skill.entity';

let skillRepo: Repository<SkillEntity>;

// after app.init() in beforeAll
skillRepo = app.get(getRepositoryToken(SkillEntity));
```

At the beginning and end of `creates and queries role-scoped skills through the adapter`, record and compare the row count:

```ts
const localSkillCount = await skillRepo.count();
expect(await skillRepo.count()).toBe(localSkillCount);
```

Place the first line immediately after the test starts and the expectation after the final persisted-profile assertion.

This single assertion covers both explicit `POST /v1/skills` and free-form profile skill creation.

- [ ] **Step 2: Run the integration test and verify the new assertion fails**

Run:

```bash
MOCK_SQLITE_PATH=:memory: pnpm run test:mock
```

Expected: `projects-happy-path.e2e-spec.ts` fails because the current mirror inserts `accessibility review` and `profile catalog skill` into the adapter skill table.

- [ ] **Step 3: Remove mock mirroring and proxy the full catalog**

In `skills.service.ts`:

1. Remove `ConflictException` from the Nest imports.
2. Delete `mirrorMockSkill`.
3. Return the mock result directly from `createWithRoles`:

```ts
const { skill } = await this.mockRequest<{ skill: RoleScopedSkill }>('/mock/skills', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, category, roleIds }),
});
return skill;
```

4. Remove the local mirroring loop from `resolveMockReferences`:

```ts
if (referenced.some((skill) => !skill)) {
  throw new BadRequestException(
    'One or more skills do not exist in the mock catalog; create them through POST /v1/skills first',
  );
}
return [...new Set((referenced as CatalogSkill[]).map((skill) => skill.id))]
  .sort((a, b) => a - b);
```

5. Make `findAll` delegate in mock mode and retain the repository branch otherwise:

```ts
async findAll(): Promise<CatalogSkill[]> {
  if (this.isMock()) {
    return (await this.mockRequest<{ skills: CatalogSkill[] }>('/mock/skills')).skills;
  }
  return this.skillRepo.find({ order: { category: 'ASC', name: 'ASC' } });
}
```

- [ ] **Step 4: Replace the E2E mirror helper with a read-only catalog comparison**

Rename `ensureSkillsMirrorMock` to `getSkillsFromAdapter` and remove its POST loop:

```ts
const getSkillsFromAdapter = async (): Promise<Map<string, Skill>> => {
  const mockResponse = await fetchJson<{ skills: Skill[] }>(`${signingServiceUrl()}/mock/skills`);
  const adapterResponse = await request(app.getHttpServer()).get('/v1/skills').expect(200);
  const mockSkills = [...mockResponse.skills].sort((a, b) => a.id - b.id);
  const adapterSkills = [...adapterResponse.body.skills as Skill[]].sort((a, b) => a.id - b.id);

  expect(adapterSkills).toEqual(mockSkills);
  return new Map(adapterSkills.map((skill) => [skill.name, skill]));
};
```

Update the lifecycle test call:

```ts
const skillsByName = await getSkillsFromAdapter();
```

- [ ] **Step 5: Run integration and build checks**

Run:

```bash
pnpm --filter abako-adapter build
MOCK_SQLITE_PATH=:memory: pnpm run test:mock
```

Expected: TypeScript exits `0`; all 10 Jest suites and 99 tests pass.

- [ ] **Step 6: Commit the task**

```bash
git add packages/adapter-api/src/modules/skills/skills.service.ts packages/adapter-api/test/projects-happy-path.e2e-spec.ts
git commit -m "refactor: use mock skill catalog directly"
```

---

### Task 2: Seed adapter references from mock without local skill rows

**Files:**
- Modify: `packages/adapter-api/test/projects-happy-path.e2e-spec.ts:1-70,331`
- Modify: `packages/adapter-api/src/modules/seed/seed.module.ts:1-18`
- Modify: `packages/adapter-api/src/modules/seed/seed.service.ts:1-65`
- Modify: `README.md:95-105`
- Modify: `packages/adapter-api/README.md:177-190`

**Interfaces:**
- Consumes: `SkillsService.findAll(): Promise<CatalogSkill[]>` from Task 1.
- Produces: seed profiles and milestones whose skill IDs come from `mock-api`, with zero adapter skill rows in mock mode.

- [ ] **Step 1: Add a failing startup assertion for the local skill table**

Insert this test before the role-scoped skill test:

```ts
it('does not seed a local skill catalog in mock mode', async () => {
  expect(await skillRepo.count()).toBe(0);
});
```

- [ ] **Step 2: Run integration and verify the seed assertion fails**

Run:

```bash
MOCK_SQLITE_PATH=:memory: pnpm run test:mock
```

Expected: the new test fails with `Expected: 0, Received: 33` because `SeedService` still inserts the legacy catalog locally.

- [ ] **Step 3: Make the seed module reuse SkillsService**

In `seed.module.ts`, import `SkillsModule` and add it to `imports` without removing the `Skill` repository needed by non-mock mode:

```ts
import { SkillsModule } from '../skills/skills.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, Developer, Project, Milestone, Rating, Skill]),
    SkillsModule,
  ],
  providers: [SeedService],
})
export class SeedModule {}
```

- [ ] **Step 4: Select the seed catalog by runtime mode**

Inject `SkillsService` in `seed.service.ts` while retaining `skillRepo` for production:

```ts
import { SkillsService } from '../skills/skills.service';

constructor(
  @InjectRepository(Client) private clientRepo: Repository<Client>,
  @InjectRepository(Developer) private developerRepo: Repository<Developer>,
  @InjectRepository(Project) private projectRepo: Repository<Project>,
  @InjectRepository(Milestone) private milestoneRepo: Repository<Milestone>,
  @InjectRepository(Rating) private ratingRepo: Repository<Rating>,
  @InjectRepository(Skill) private skillRepo: Repository<Skill>,
  private readonly skillsService: SkillsService,
) {}
```

Replace the unconditional skill save with:

```ts
const seededSkills = process.env.USE_MOCK_AUTH === 'true'
  ? await this.skillsService.findAll()
  : await this.skillRepo.save([
      ...softwareSkills.map((name) => this.skillRepo.create({ name, category: 'software' })),
      ...softSkills.map((name) => this.skillRepo.create({ name, category: 'soft' })),
    ]);
```

Keep the existing `skillIdByName` and every profile/milestone `skillIds(...)` call unchanged.

- [ ] **Step 5: Update ownership documentation**

In `README.md`, replace the mock catalog ownership paragraph with:

```md
Mock/dev mode stores the authoritative many-to-many `skill_roles` catalog in the same SQLite database as roles and workers. Adapter profiles and assignments store only skill IDs; all mock-mode skill listing, creation, validation, filtering, and name lookup delegate to `mock-api`. Outside mock mode, the adapter keeps its legacy local skill catalog until a production smart contract replaces it.
```

In `packages/adapter-api/README.md`, replace the mirror paragraph with:

```md
The internal mock equivalents are `POST /mock/skills`, `GET /mock/skills/ids`, and `GET /mock/skills/:skillId`. In mock mode the adapter never persists a second skill catalog: profiles and assignments keep only IDs, while listing, creation, validation, and name lookup delegate to `mock-api`. New profile skill names are created in the mock with the user's registered roles. Outside mock mode, legacy local creation and listing remain available until a production smart contract owns this behavior.
```

- [ ] **Step 6: Run the complete verification suite**

Run:

```bash
MOCK_SQLITE_PATH=:memory: pnpm --filter mock-api test
pnpm --filter abako-adapter build
MOCK_SQLITE_PATH=:memory: pnpm run test:mock
git diff --check
```

Expected:

- mock smoke: 123 passed, 0 failed;
- adapter build exits `0`;
- Jest: 10 suites and 100 tests pass;
- `git diff --check` prints no output and exits `0`.

- [ ] **Step 7: Review scope and commit the task**

Confirm `git status --short` shows no generated SQLite files and that `.gitignore` remains unstaged. Then commit only the task files:

```bash
git add packages/adapter-api/src/modules/seed/seed.module.ts packages/adapter-api/src/modules/seed/seed.service.ts packages/adapter-api/test/projects-happy-path.e2e-spec.ts README.md packages/adapter-api/README.md
git commit -m "refactor: make mock the skill source of truth"
```
