import { INestApplication, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { CreateMilestoneRequest } from '../src/modules/projects/types';
import { MockAuthHelper } from './mock-auth-helper';

type Skill = { id: number; name: string; category: 'software' | 'soft' };

type TestActor = {
  key: string;
  name: string;
  userId: string;
  accountId: string;
  token: string;
  developerId?: number;
  clientId?: number;
};

type WorkerDefinition = {
  key: string;
  name: string;
  role: string;
  skillNames: string[];
  weeklyHours: number;
  coordinator?: boolean;
};

type MockAssignment = {
  assignment_key: string;
  hours: number;
  skill_ids: number[];
  account_id: string;
};

type MockTask = {
  id: number;
  cost: string;
  completed: boolean;
  status: Record<string, unknown>;
  assigned_to: string | null;
  assignments: MockAssignment[];
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('Issue #60 project happy path E2E', () => {
  let app: INestApplication;
  let auth: MockAuthHelper;

  const signingServiceUrl = () => process.env.SIGNING_SERVICE_URL || 'http://localhost:4010';
  const federateServerUrl = () => process.env.FEDERATE_SERVER || 'http://localhost:4010/api';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    auth = new MockAuthHelper(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  const expect2xx = (response: request.Response) => {
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(300);
  };

  const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(url, init);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText} ${url}`);
    }
    return response.json() as Promise<T>;
  };

  const deployMockContract = async (path: string, body: Record<string, unknown> = {}) => {
    const result = await fetchJson<{ success: boolean; address: string }>(
      `${signingServiceUrl()}${path}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    expect(result.success).toBe(true);
    expect(result.address).toBeTruthy();
    return result.address;
  };

  const fundAccount = async (address: string, amount = '1000000', assetId = 1) => {
    const result = await fetchJson<{ ok: boolean }>(`${federateServerUrl()}/fund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, amount, assetId }),
    });
    expect(result.ok).toBe(true);
  };

  const balanceOf = async (address: string, assetId = 1): Promise<bigint> => {
    const data = await fetchJson<{ balance: string }>(
      `${federateServerUrl()}/balance?address=${encodeURIComponent(address)}&assetId=${assetId}`,
    );
    const balance = BigInt(data.balance);
    expect(balance >= 0n).toBe(true);
    return balance;
  };

  const expectNonNegativeBalances = async (addresses: string[]) => {
    for (const address of [...new Set(addresses.filter(Boolean))]) {
      await balanceOf(address);
    }
  };

  const ensureSkillsMirrorMock = async (): Promise<Map<string, Skill>> => {
    const mockSkills = await fetchJson<{ skills: Skill[] }>(`${signingServiceUrl()}/mock/skills`);
    const sortedMockSkills = [...mockSkills.skills].sort((a, b) => a.id - b.id);

    for (const skill of sortedMockSkills) {
      const response = await request(app.getHttpServer())
        .post('/v1/skills')
        .send({ name: skill.name, category: skill.category });
      expect2xx(response);
    }

    const adapterResponse = await request(app.getHttpServer())
      .get('/v1/skills')
      .expect(200);
    const skills = adapterResponse.body.skills as Skill[];
    const byName = new Map(skills.map(skill => [skill.name, skill]));

    for (const mockSkill of sortedMockSkills) {
      const adapterSkill = byName.get(mockSkill.name);
      expect(adapterSkill).toBeDefined();
      expect(adapterSkill!.id).toBe(mockSkill.id);
    }

    return byName;
  };

  const skillIds = (skillsByName: Map<string, Skill>, names: string[]) => (
    names.map(name => {
      const skill = skillsByName.get(name);
      if (!skill) throw new Error(`Missing skill ${name}`);
      return skill.id;
    })
  );

  const registerClient = async (runId: string): Promise<TestActor> => {
    const userId = `issue60-client-${runId}@example.com`;
    const { token, accountId } = await auth.registerAndConnect(userId);
    const response = await request(app.getHttpServer())
      .post('/v1/clients')
      .send({
        userId,
        email: userId,
        name: 'Issue 60 Client',
        company: 'Issue 60 Labs',
        department: 'Product',
        website: 'https://issue60.example.com',
        description: 'Client used for the issue 60 happy path test',
        location: 'Remote',
        languages: ['ENG', 'SPA'],
      })
      .expect(201);

    return {
      key: 'client',
      name: 'Issue 60 Client',
      userId,
      accountId,
      token,
      clientId: response.body.clientId,
    };
  };

  const registerDeveloper = async (
    runId: string,
    definition: WorkerDefinition,
    skillsByName: Map<string, Skill>,
  ): Promise<TestActor> => {
    const userId = `issue60-${definition.key}-${runId}@example.com`;
    const { token, accountId } = await auth.registerAndConnect(userId);
    const createResponse = await request(app.getHttpServer())
      .post('/v1/developers')
      .send({
        userId,
        email: userId,
        name: definition.name,
        githubUsername: `issue60-${definition.key}`,
        portfolioUrl: `https://issue60.example.com/${definition.key}`,
      })
      .expect(201);

    const developerId = createResponse.body.developerId as number;
    await request(app.getHttpServer())
      .put(`/v1/developers/${developerId}`)
      .send({
        userId,
        email: userId,
        name: definition.name,
        githubUsername: `issue60-${definition.key}`,
        portfolioUrl: `https://issue60.example.com/${definition.key}`,
        bio: `Issue 60 ${definition.role}`,
        background: 'Mock profile for project happy path testing',
        proficiency: 'senior',
        role: definition.role,
        location: 'Remote',
        availability: definition.weeklyHours > 0 ? 'WeeklyHours' : 'NotAvailable',
        languages: ['ENG'],
        skills: skillIds(skillsByName, definition.skillNames),
        availableHoursPerWeek: definition.weeklyHours,
      })
      .expect(200);

    if (definition.coordinator) {
      const eligibilityResponse = await request(app.getHttpServer())
        .put(`/v1/developers/${developerId}/coordinator-eligibility`)
        .send({ isCoordinator: true })
        .expect(200);
      expect(eligibilityResponse.body.isCoordinator).toBe(true);
    }

    const persistedProfile = await request(app.getHttpServer())
      .get(`/v1/developers/${developerId}`)
      .expect(200);
    expect(persistedProfile.body.developer).not.toHaveProperty('isCoordinator');

    return {
      key: definition.key,
      name: definition.name,
      userId,
      accountId,
      token,
      developerId,
    };
  };

  const registerWorkersInCalendar = async (
    calendarContract: string,
    actors: TestActor[],
    authToken: string,
  ) => {
    const response = await request(app.getHttpServer())
      .post(`/v1/calendar/${calendarContract}/register_workers`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ workers: actors.map(actor => actor.accountId) });
    expect2xx(response);
    expect(response.body.success).toBe(true);
  };

  const setWorkerAvailability = async (
    calendarContract: string,
    actor: TestActor,
    weeklyHours: number,
  ) => {
    const response = await request(app.getHttpServer())
      .post(`/v1/calendar/${calendarContract}/set_availability`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ availability: { type: 'PermanentWeeklyHours', value: weeklyHours } });
    expect2xx(response);
    expect(response.body.success).toBe(true);
  };

  const getAvailabilityTotals = async (calendarContract: string): Promise<Map<string, number>> => {
    const response = await request(app.getHttpServer())
      .get(`/v1/calendar/${calendarContract}/get_all_workers_availability`)
      .expect(200);
    const rows = response.body.response as Array<{ worker: string; total_hours: number }>;
    return new Map(rows.map(row => [row.worker, row.total_hours]));
  };

  const getTasks = async (projectId: string): Promise<MockTask[]> => {
    const response = await request(app.getHttpServer())
      .get(`/v1/projects/${projectId}/get_all_tasks`)
      .expect(200);
    expect(response.body.success).toBe(true);
    return response.body.response as MockTask[];
  };

  const hasStatus = (task: MockTask, status: string) => (
    task.status && Object.prototype.hasOwnProperty.call(task.status, status)
  );

  const activeTaskOf = (tasks: MockTask[]) => tasks.find(task => hasStatus(task, 'Active'));

  const waitForProjectCreated = async (projectId: string) => {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const response = await request(app.getHttpServer())
        .get(`/v1/projects/${projectId}/get_project_info`)
        .expect(200);
      if (response.body.creationStatus === 'failed') {
        throw new Error(response.body.creationError || 'Project creation failed');
      }
      if (
        response.body.creationStatus === 'created' &&
        response.body.contractAddress &&
        response.body.consultantId
      ) {
        return response.body;
      }
      await delay(100);
    }
    throw new Error(`Project ${projectId} was not created in time`);
  };

  const assertReservationDelta = (
    before: Map<string, number>,
    after: Map<string, number>,
    assignments: MockAssignment[],
  ) => {
    for (const assignment of assignments) {
      const beforeHours = before.get(assignment.account_id);
      const afterHours = after.get(assignment.account_id);
      expect(beforeHours).toBeDefined();
      expect(afterHours).toBeDefined();
      expect(beforeHours! - afterHours!).toBe(assignment.hours);
    }
  };

  it('runs the complete project lifecycle with variable teams and documented mock payment limits', async () => {
    const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const skillsByName = await ensureSkillsMirrorMock();
    const ratingsContract = await deployMockContract('/ratings/deploy/v5');
    const calendarContract = await deployMockContract('/calendar/deploy/v5', {
      ratings_contract: ratingsContract,
    });

    const workerDefinitions: WorkerDefinition[] = [
      { key: 'backend', name: 'Issue 60 Backend', role: 'Backend', skillNames: ['rust'], weeklyHours: 20 },
      { key: 'frontend', name: 'Issue 60 Frontend', role: 'Frontend', skillNames: ['typescript'], weeklyHours: 20 },
      { key: 'qa', name: 'Issue 60 QA', role: 'QA', skillNames: ['automated testing'], weeklyHours: 20 },
      { key: 'designer', name: 'Issue 60 Designer', role: 'Designer', skillNames: ['ui/ux'], weeklyHours: 20 },
      { key: 'devops', name: 'Issue 60 DevOps', role: 'DevOps', skillNames: ['docker'], weeklyHours: 20 },
      { key: 'backend-low', name: 'Issue 60 Backend Low', role: 'Backend', skillNames: ['rust'], weeklyHours: 0 },
      { key: 'frontend-low', name: 'Issue 60 Frontend Low', role: 'Frontend', skillNames: ['typescript'], weeklyHours: 0 },
      { key: 'qa-low', name: 'Issue 60 QA Low', role: 'QA', skillNames: ['automated testing'], weeklyHours: 0 },
      { key: 'designer-low', name: 'Issue 60 Designer Low', role: 'Designer', skillNames: ['ui/ux'], weeklyHours: 0 },
      { key: 'devops-low', name: 'Issue 60 DevOps Low', role: 'DevOps', skillNames: ['docker'], weeklyHours: 0 },
      { key: 'coordinator-a', name: 'Issue 60 Coordinator A', role: 'Coordinator', skillNames: ['leadership'], weeklyHours: 20, coordinator: true },
      { key: 'coordinator-b', name: 'Issue 60 Coordinator B', role: 'Coordinator', skillNames: ['facilitation'], weeklyHours: 20, coordinator: true },
    ];

    const client = await registerClient(runId);
    const developers: TestActor[] = [];
    for (const definition of workerDefinitions) {
      developers.push(await registerDeveloper(runId, definition, skillsByName));
    }

    const workers = developers.filter(actor => !actor.key.startsWith('coordinator-'));
    const lowWorkers = workers.filter(actor => actor.key.endsWith('-low'));
    const coordinators = developers.filter(actor => actor.key.startsWith('coordinator-'));
    const coordinatorAccountIds = new Set(coordinators.map(actor => actor.accountId));
    const coordinatorByDeveloperId = new Map(coordinators.map(actor => [String(actor.developerId), actor]));

    await registerWorkersInCalendar(calendarContract, developers, client.token);
    for (const definition of workerDefinitions) {
      const actor = developers.find(item => item.key === definition.key)!;
      await setWorkerAvailability(calendarContract, actor, definition.weeklyHours);
    }

    const availableResponse = await request(app.getHttpServer())
      .get(`/v1/calendar/${calendarContract}/get_available_workers?min_hours=20`)
      .expect(200);
    const availableAccounts = new Set(
      (availableResponse.body.response as Array<{ worker: string }>).map(row => row.worker),
    );
    for (const lowWorker of lowWorkers) {
      expect(availableAccounts.has(lowWorker.accountId)).toBe(false);
    }

    await fundAccount(client.accountId, '1000000');
    const initialClientBalance = await balanceOf(client.accountId);
    expect(initialClientBalance > 0n).toBe(true);

    const projectBudget = 14000;
    const advancePercentage = 10;
    const deployResponse = await request(app.getHttpServer())
      .post('/v1/projects/deploy/v5')
      .set('Authorization', `Bearer ${client.token}`)
      .send({
        title: 'Issue 60 Marketplace Build',
        summary: 'Realistic happy path for frontend integration',
        description: 'Four milestones with variable team sizes and mock ledger payments',
        url: 'https://issue60.example.com/project',
        projectType: 3,
        budget: projectBudget,
        deliveryTime: 45,
        calendarContract,
        ratingsContract,
      })
      .expect(200);

    const projectId = deployResponse.body.projectId as string;
    const project = await waitForProjectCreated(projectId);
    const contractAddress = project.contractAddress as string;
    expect(coordinatorByDeveloperId.has(String(project.consultantId))).toBe(true);
    const coordinator = coordinatorByDeveloperId.get(String(project.consultantId))!;
    expect(coordinatorAccountIds.has(coordinator.accountId)).toBe(true);

    const mkReq = (assignmentKey: string, hours: number, names: string[]) => ({
      assignmentKey,
      hours,
      skillIds: skillIds(skillsByName, names),
    });
    const milestones: CreateMilestoneRequest[] = [
      {
        title: 'Milestone 1 - Foundation',
        description: 'Five-worker foundation milestone',
        budget: 5000,
        deliveryTime: 10,
        requirements: [
          mkReq('backend', 20, ['rust']),
          mkReq('frontend', 20, ['typescript']),
          mkReq('qa', 20, ['automated testing']),
          mkReq('designer', 20, ['ui/ux']),
          mkReq('devops', 20, ['docker']),
        ],
      },
      {
        title: 'Milestone 2 - Product Slice',
        description: 'Three-worker product milestone',
        budget: 3000,
        deliveryTime: 8,
        requirements: [
          mkReq('backend', 20, ['rust']),
          mkReq('frontend', 20, ['typescript']),
          mkReq('qa', 20, ['automated testing']),
        ],
      },
      {
        title: 'Milestone 3 - Hardening',
        description: 'Four-worker hardening milestone',
        budget: 4000,
        deliveryTime: 12,
        requirements: [
          mkReq('backend', 20, ['rust']),
          mkReq('frontend', 20, ['typescript']),
          mkReq('designer', 20, ['ui/ux']),
          mkReq('devops', 20, ['docker']),
        ],
      },
      {
        title: 'Milestone 4 - Launch',
        description: 'Two-worker launch milestone',
        budget: 2000,
        deliveryTime: 6,
        requirements: [
          mkReq('backend', 20, ['rust']),
          mkReq('qa', 20, ['automated testing']),
        ],
      },
    ];

    const proposeResponse = await request(app.getHttpServer())
      .post(`/v1/projects/${projectId}/propose_scope`)
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({
        milestones,
        advance_payment_percentage: advancePercentage,
        document_hash: `issue60-${runId}`,
      })
      .expect(201);
    expect(proposeResponse.body.success).toBe(true);
    expect(proposeResponse.body.milestones).toHaveLength(4);

    const milestoneIds = (proposeResponse.body.milestones as Array<{ id: number }>)
      .map(milestone => milestone.id);
    const expectedWorkerCounts = new Map([
      [milestoneIds[0], 5],
      [milestoneIds[1], 3],
      [milestoneIds[2], 4],
      [milestoneIds[3], 2],
    ]);

    const beforeApprovalAvailability = await getAvailabilityTotals(calendarContract);
    const beforeApprovalClientBalance = await balanceOf(client.accountId);
    const approveResponse = await request(app.getHttpServer())
      .post(`/v1/projects/${projectId}/approve_scope`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ approved_task_ids: milestoneIds })
      .expect(201);
    expect(approveResponse.body.success).toBe(true);
    expect(approveResponse.body.autoAssignTeam).toMatchObject({
      triggered: true,
      success: true,
    });

    const afterApprovalClientBalance = await balanceOf(client.accountId);
    const expectedAdvance = BigInt(Math.floor(projectBudget * advancePercentage / 100));
    expect(beforeApprovalClientBalance - afterApprovalClientBalance).toBe(expectedAdvance);

    let tasks = await getTasks(projectId);
    let activeTask = activeTaskOf(tasks);
    expect(activeTask?.id).toBe(milestoneIds[0]);
    expect(activeTask!.assignments).toHaveLength(expectedWorkerCounts.get(activeTask!.id)!);
    assertReservationDelta(
      beforeApprovalAvailability,
      await getAvailabilityTotals(calendarContract),
      activeTask!.assignments,
    );

    const lowAccountIds = new Set(lowWorkers.map(worker => worker.accountId));
    const assignmentOwnerByKey = new Map<string, string>();
    const touchedAccounts = new Set<string>([client.accountId, contractAddress]);

    for (const milestoneId of milestoneIds) {
      tasks = await getTasks(projectId);
      activeTask = tasks.find(task => task.id === milestoneId)!;
      expect(activeTask).toBeDefined();
      expect(hasStatus(activeTask, 'Active')).toBe(true);
      expect(activeTask.assignments).toHaveLength(expectedWorkerCounts.get(milestoneId)!);

      for (const assignment of activeTask.assignments) {
        expect(lowAccountIds.has(assignment.account_id)).toBe(false);
        const previousOwner = assignmentOwnerByKey.get(assignment.assignment_key);
        if (previousOwner) {
          expect(assignment.account_id).toBe(previousOwner);
        } else {
          assignmentOwnerByKey.set(assignment.assignment_key, assignment.account_id);
        }
        touchedAccounts.add(assignment.account_id);
      }

      const primaryWorker = activeTask.assigned_to;
      expect(primaryWorker).toBe(activeTask.assignments[0].account_id);
      const clientBeforeMilestone = await balanceOf(client.accountId);
      const primaryBeforeMilestone = await balanceOf(primaryWorker!);
      const availabilityBeforeComplete = await getAvailabilityTotals(calendarContract);

      await request(app.getHttpServer())
        .post(`/v1/projects/${projectId}/submit_task_for_review`)
        .set('Authorization', `Bearer ${coordinator.token}`)
        .send({ task_id: milestoneId })
        .expect(201);

      tasks = await getTasks(projectId);
      expect(hasStatus(tasks.find(task => task.id === milestoneId)!, 'PendingReview')).toBe(true);

      await request(app.getHttpServer())
        .post(`/v1/projects/${projectId}/complete_task`)
        .set('Authorization', `Bearer ${client.token}`)
        .send({ task_id: milestoneId })
        .expect(201);

      const milestoneCost = BigInt(activeTask.cost);
      expect(clientBeforeMilestone - await balanceOf(client.accountId)).toBe(milestoneCost);
      expect(await balanceOf(primaryWorker!) - primaryBeforeMilestone).toBe(milestoneCost);

      tasks = await getTasks(projectId);
      expect(tasks.find(task => task.id === milestoneId)!.completed).toBe(true);

      const nextMilestoneId = milestoneIds[milestoneIds.indexOf(milestoneId) + 1];
      if (nextMilestoneId) {
        const nextTask = tasks.find(task => task.id === nextMilestoneId)!;
        expect(hasStatus(nextTask, 'Active')).toBe(true);
        expect(nextTask.assignments).toHaveLength(expectedWorkerCounts.get(nextMilestoneId)!);
        assertReservationDelta(
          availabilityBeforeComplete,
          await getAvailabilityTotals(calendarContract),
          nextTask.assignments,
        );
      }

      await expectNonNegativeBalances([...touchedAccounts]);
    }

    const finalAvailability = await getAvailabilityTotals(calendarContract);
    for (const lowWorker of lowWorkers) {
      expect(finalAvailability.get(lowWorker.accountId)).toBe(beforeApprovalAvailability.get(lowWorker.accountId));
    }

    const teamResponse = await request(app.getHttpServer())
      .get(`/v1/projects/${projectId}/get_team`)
      .expect(200);
    const teamMembers = teamResponse.body.response as Array<{ account_id: string; developerId: number | null }>;
    const teamAccounts = teamMembers.map(member => member.account_id);
    expect(teamAccounts.some(account => lowAccountIds.has(account))).toBe(false);
    expect(teamAccounts.some(account => coordinatorAccountIds.has(account))).toBe(false);

    await request(app.getHttpServer())
      .post(`/v1/projects/${projectId}/mark_completed`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({
        ratings: teamAccounts.map(account => [account, 8]),
        coordinatorRating: 9,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/projects/${projectId}/submit_coordinator_ratings`)
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({
        clientRating: 9,
        teamRatings: teamAccounts.map(account => [account, 8]),
      })
      .expect(201);

    const developerRater = teamMembers.find(member => member.developerId && member.developerId !== coordinator.developerId);
    expect(developerRater).toBeDefined();
    const developerRaterActor = workers.find(worker => worker.accountId === developerRater!.account_id);
    expect(developerRaterActor).toBeDefined();
    expect(developerRaterActor!.developerId).not.toBe(coordinator.developerId);

    await request(app.getHttpServer())
      .post(`/v1/projects/${projectId}/submit_developer_rating`)
      .set('Authorization', `Bearer ${developerRaterActor!.token}`)
      .send({ coordinatorRating: 8 })
      .expect(201);

    const projectRatingsResponse = await request(app.getHttpServer())
      .get(`/v1/ratings/project/${projectId}`)
      .expect(200);
    const ratings = projectRatingsResponse.body.ratings as Array<{
      clientId: string;
      developerId: string;
      rating: number;
    }>;
    expect(ratings.length).toBeGreaterThanOrEqual(teamAccounts.length * 2 + 1);
    expect(ratings.some(rating => (
      rating.clientId === String(coordinator.developerId) &&
      rating.developerId === String(coordinator.developerId)
    ))).toBe(false);
    expect(ratings.some(rating => (
      rating.clientId === String(developerRaterActor!.developerId) &&
      rating.developerId === String(developerRaterActor!.developerId)
    ))).toBe(false);

    const coordinatorRatingsResponse = await request(app.getHttpServer())
      .get(`/v1/ratings/developer/${coordinator.developerId}`)
      .expect(200);
    expect(coordinatorRatingsResponse.body.totalRatings).toBeGreaterThanOrEqual(1);
    expect(coordinatorRatingsResponse.body.averageRating).toBeGreaterThan(0);

    const teamDeveloperId = teamMembers.find(member => member.developerId)?.developerId;
    expect(teamDeveloperId).toBeDefined();
    const teamRatingsResponse = await request(app.getHttpServer())
      .get(`/v1/ratings/developer/${teamDeveloperId}`)
      .expect(200);
    expect(teamRatingsResponse.body.totalRatings).toBeGreaterThanOrEqual(1);
    expect(teamRatingsResponse.body.averageRating).toBeGreaterThan(0);

    const completedProject = await request(app.getHttpServer())
      .get(`/v1/projects/${projectId}/get_project_info`)
      .expect(200);
    expect(completedProject.body.state).toBe('completed');
    await expectNonNegativeBalances([...touchedAccounts, ...teamAccounts]);
  });
});
