# External Skill Source of Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the adapter skill catalog from every application flow so `mock-api` is the only source of truth today and the smart contract can replace it directly later.

**Architecture:** `SkillsService` is a gateway with no skill repository. In mock mode every catalog read, write, and validation delegates to `/mock/skills`; outside mock mode those operations return `501` until a contract-backed provider replaces the mock calls. Adapter seed data runs only in mock mode and obtains skill IDs from `mock-api`. The historical table remains physically registered only to avoid an implicit destructive schema change under TypeORM `synchronize`; no application code reads or writes it.

**Tech Stack:** NestJS, TypeORM, Express mock-api, SQLite, Jest, Supertest, pnpm.

## Global Constraints

- Developer profiles remain stored in `adapter-api` and keep `skills: number[]`.
- `mock-api` owns skill IDs, names, categories, role IDs, and skill-role relationships for the current mock/dev phase.
- Future production code must replace the mock provider with the smart contract, never with local storage.
- `adapter-api` must not read, write, seed, cache, or synchronize catalog records through application code.
- Keep the historical `Skill` entity in `DatabaseModule` for this issue so `synchronize` cannot implicitly remove a deployed table. Do not inject its repository or add a schema migration.
- Outside mock mode, all skill/role catalog-dependent operations return `501`.
- Keep SDK versions, production contracts, production authentication, and deployed databases unchanged.
- Preserve the unrelated `.gitignore` modification and never stage it.

---

### Task 1: Make SkillsService a provider-only gateway

**Files:**

- Create: `packages/adapter-api/test/skills.service.spec.ts`
- Modify: `packages/adapter-api/test/projects-happy-path.e2e-spec.ts:1-149,331-424`
- Modify: `packages/adapter-api/src/modules/skills/skills.module.ts:1-14`
- Modify: `packages/adapter-api/src/modules/skills/skills.service.ts:1-240`

**Interfaces:**

- Consumes in mock mode: `GET /mock/skills`, `POST /mock/skills`, `GET /mock/skills/ids`, `GET /mock/skills/:id`, and mock role lookups.
- Produces: catalog values and IDs returned by `mock-api`; `501` for the same operations outside mock mode.

- [ ] **Step 1: Add failing non-mock gateway tests**

Create `test/skills.service.spec.ts`. Build `SkillsService` through a Nest testing module with `ConfigService` and a temporary mocked `Skill` repository provider so the test compiles before the repository is removed:

```ts
import { NotImplementedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '../src/config/config.service';
import { Skill } from '../src/database/entities/skill.entity';
import { SkillsService } from '../src/modules/skills/skills.service';

describe('SkillsService source of truth', () => {
  let service: SkillsService;
  const previousMockMode = process.env.USE_MOCK_AUTH;

  beforeAll(async () => {
    delete process.env.USE_MOCK_AUTH;
    const module = await Test.createTestingModule({
      providers: [
        ConfigService,
        SkillsService,
        { provide: getRepositoryToken(Skill), useValue: {} },
      ],
    }).compile();
    service = module.get(SkillsService);
  });

  afterAll(() => {
    if (previousMockMode === undefined) delete process.env.USE_MOCK_AUTH;
    else process.env.USE_MOCK_AUTH = previousMockMode;
  });

  it.each([
    ['list', () => service.findAll()],
    ['create', () => service.createWithRoles('rust', 'software', [3])],
    ['list IDs', () => service.findIds()],
    ['lookup', () => service.findNameById('1')],
    ['role validation', () => service.validateRoleId(3)],
    ['profile reference resolution', () => service.resolveReferences([1])],
  ])('returns 501 for %s before the contract provider exists', async (_name, operation) => {
    await expect(operation()).rejects.toBeInstanceOf(NotImplementedException);
  });
});
```

Run:

```bash
pnpm --filter abako-adapter test -- --runInBand test/skills.service.spec.ts
```

Expected: the cases fail because the service still takes local fallback paths or touches the mocked repository.

- [ ] **Step 2: Add a failing no-local-write integration assertion**

In `projects-happy-path.e2e-spec.ts`, resolve the historical repository through the root data source and record its count before the role-scoped skill flow:

```ts
import { DataSource, Repository } from 'typeorm';
import { Skill as SkillEntity } from '../src/database/entities/skill.entity';

let skillRepo: Repository<SkillEntity>;

// after app.init()
skillRepo = app.get(DataSource).getRepository(SkillEntity);

// at the start of the role-scoped skill test
const localSkillCount = await skillRepo.count();

// after explicit and profile skill creation
expect(await skillRepo.count()).toBe(localSkillCount);
```

Run:

```bash
MOCK_SQLITE_PATH=:memory: pnpm run test:mock
```

Expected: `projects-happy-path.e2e-spec.ts` fails because the current mirror inserts `accessibility review` and `profile catalog skill` into the adapter skill table.

- [ ] **Step 3: Remove the repository and every local fallback from SkillsService**

In `skills.service.ts`:

1. Remove `ConflictException`, `NotFoundException`, `InjectRepository`, TypeORM, and `Skill` imports.
2. Inject only `ConfigService`.
3. Delete `ensure`, `create`, and `mirrorMockSkill`.
4. Add one guard used by all catalog-dependent operations:

```ts
private requireMockProvider(): void {
  if (!this.isMock()) {
    throw new NotImplementedException(
      'Skill and role catalogs are unavailable until the production smart contract is implemented',
    );
  }
}
```

5. Call the guard before `resolveReferences`, `createWithRoles`, `findIds`, `findNameById`, `validateRoleId`, and `findAll` do any validation or I/O.
6. Return the mock result directly from `createWithRoles`:

```ts
const { skill } = await this.mockRequest<{ skill: RoleScopedSkill }>('/mock/skills', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, category, roleIds }),
});
return skill;
```

7. Remove the local mirroring loop from `resolveMockReferences`:

```ts
if (referenced.some((skill) => !skill)) {
  throw new BadRequestException(
    'One or more skills do not exist in the mock catalog; create them through POST /v1/skills first',
  );
}
return [...new Set((referenced as CatalogSkill[]).map((skill) => skill.id))]
  .sort((a, b) => a - b);
```

8. Make `findAll` proxy the mock list:

```ts
async findAll(): Promise<CatalogSkill[]> {
  this.requireMockProvider();
  return (await this.mockRequest<{ skills: CatalogSkill[] }>('/mock/skills')).skills;
}
```

- [ ] **Step 4: Remove Skill repository registration from SkillsModule**

Delete the `TypeOrmModule` and `Skill` imports and reduce the module to:

```ts
@Module({
  controllers: [SkillsController],
  providers: [SkillsService],
  exports: [SkillsService],
})
export class SkillsModule {}
```

Do not remove `Skill` from the root `DatabaseModule` in this issue. With `synchronize: true`, retaining the entity metadata avoids an implicit destructive schema change; application code no longer obtains its repository through `SkillsModule`.

- [ ] **Step 5: Replace the E2E mirror helper with a read-only catalog comparison**

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

- [ ] **Step 6: Run focused and integration checks**

Run:

```bash
pnpm --filter abako-adapter test -- --runInBand test/skills.service.spec.ts
pnpm --filter abako-adapter build
MOCK_SQLITE_PATH=:memory: pnpm run test:mock
```

Expected: the focused tests pass, TypeScript exits `0`, and the integration suite passes.

- [ ] **Step 7: Commit the task**

```bash
git add packages/adapter-api/src/modules/skills/skills.module.ts packages/adapter-api/src/modules/skills/skills.service.ts packages/adapter-api/test/skills.service.spec.ts packages/adapter-api/test/projects-happy-path.e2e-spec.ts
git commit -m "refactor: remove adapter skill catalog"
```

---

### Task 2: Seed adapter references from the external catalog

**Files:**

- Modify: `packages/adapter-api/src/modules/seed/seed.module.ts:1-18`
- Modify: `packages/adapter-api/src/modules/seed/seed.service.ts:1-65`
- Modify: `packages/adapter-api/test/projects-happy-path.e2e-spec.ts:331`
- Modify: `README.md:95-105`
- Modify: `packages/adapter-api/README.md:177-190`

**Interfaces:**

- Consumes: `SkillsService.findAll(): Promise<CatalogSkill[]>` from Task 1.
- Produces: mock-only seed profiles and milestones whose skill IDs come from `mock-api`, with zero adapter skill writes.

- [ ] **Step 1: Add a failing startup assertion for the historical table**

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

Expected: the new test fails with `Expected: 0, Received: 33` because `SeedService` still inserts the historical catalog locally.

- [ ] **Step 3: Make the seed module reuse SkillsService**

In `seed.module.ts`, remove the `Skill` entity import and add `SkillsModule`:

```ts
import { SkillsModule } from '../skills/skills.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, Developer, Project, Milestone, Rating]),
    SkillsModule,
  ],
  providers: [SeedService],
})
export class SeedModule {}
```

- [ ] **Step 4: Read the seed catalog from SkillsService**

Remove the `Skill` entity/repository imports and inject `SkillsService`:

```ts
import { SkillsService } from '../skills/skills.service';

constructor(
  @InjectRepository(Client) private clientRepo: Repository<Client>,
  @InjectRepository(Developer) private developerRepo: Repository<Developer>,
  @InjectRepository(Project) private projectRepo: Repository<Project>,
  @InjectRepository(Milestone) private milestoneRepo: Repository<Milestone>,
  @InjectRepository(Rating) private ratingRepo: Repository<Rating>,
  private readonly skillsService: SkillsService,
) {}
```

Delete `softwareSkills` and `softSkills`. Replace the local save with:

```ts
const seededSkills = await this.skillsService.findAll();
```

Keep the existing `skillIdByName` and every profile/milestone `skillIds(...)` call unchanged.

`onModuleInit` already exits when `USE_MOCK_AUTH !== 'true'`, so there is no non-mock seed path to preserve or replace.

- [ ] **Step 5: Update ownership documentation**

In `README.md`, state:

```md
Mock/dev mode stores the authoritative many-to-many `skill_roles` catalog in the same SQLite database as roles and workers. Adapter profiles and assignments store only external skill IDs; all skill listing, creation, validation, filtering, and name lookup delegate to `mock-api`. The adapter has no catalog mirror. Outside mock mode these operations return `501` until the smart contract replaces `mock-api` as the single source of truth.
```

In `packages/adapter-api/README.md`, state:

```md
The internal mock equivalents are `POST /mock/skills`, `GET /mock/skills/ids`, and `GET /mock/skills/:skillId`. The adapter never persists a second skill or role catalog: profiles and assignments keep only IDs, while listing, creation, validation, and name lookup delegate to `mock-api`. New profile skill names are created in the mock with the user's registered roles. Outside mock mode, catalog-dependent operations return `501` until a smart-contract provider replaces the mock.
```

Document that the historical `skills` table may remain physically present but is unused and is not a source of truth.

- [ ] **Step 6: Run the complete verification suite**

Run:

```bash
MOCK_SQLITE_PATH=:memory: pnpm --filter mock-api test
pnpm --filter abako-adapter build
MOCK_SQLITE_PATH=:memory: pnpm run test:mock
git diff --check
```

Expected:

- mock smoke passes;
- adapter build exits `0`;
- the focused and full integration suites pass;
- `git diff --check` prints no output and exits `0`.

- [ ] **Step 7: Review scope and commit the task**

Confirm `git status --short` shows no generated SQLite files and that `.gitignore` remains unstaged. Then commit only the task files:

```bash
git add packages/adapter-api/src/modules/seed/seed.module.ts packages/adapter-api/src/modules/seed/seed.service.ts packages/adapter-api/test/projects-happy-path.e2e-spec.ts README.md packages/adapter-api/README.md
git commit -m "refactor: seed skill references from mock"
```
