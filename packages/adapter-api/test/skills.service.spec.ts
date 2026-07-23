import { NotImplementedException } from '@nestjs/common';
import { ConfigService } from '../src/config/config.service';
import { SkillsService } from '../src/modules/skills/skills.service';

describe('SkillsService provider boundary', () => {
  let service: SkillsService;
  const previousMockMode = process.env.USE_MOCK_AUTH;

  beforeAll(() => {
    delete process.env.USE_MOCK_AUTH;
    service = new SkillsService(new ConfigService());
  });

  afterAll(() => {
    if (previousMockMode === undefined) delete process.env.USE_MOCK_AUTH;
    else process.env.USE_MOCK_AUTH = previousMockMode;
  });

  it.each([
    ['list skills', () => service.findAll()],
    ['create a skill', () => service.createWithRoles('rust', 'software', [3])],
    ['list skill IDs', () => service.findIds()],
    ['look up a skill', () => service.findNameById('1')],
    ['validate a role', () => service.validateRoleId(3)],
    ['resolve profile skills', () => service.resolveReferences([1])],
    ['read profile qualifications', () => (service as any).getUserQualifications('user')],
    ['replace profile qualifications', () => (
      service as any
    ).replaceUserQualifications('user', [1], [2])],
  ])('returns 501 for %s before the contract provider exists', async (_name, operation) => {
    await expect(Promise.resolve().then(operation)).rejects.toBeInstanceOf(NotImplementedException);
  });
});
