import { normalizeSkills } from '../src/modules/projects/assignment.util';

describe('assignment utilities', () => {
  it('normalizes skills to unique lowercase values', () => {
    expect(normalizeSkills([' Rust ', 'rust', 'TypeScript', ''])).toEqual([
      'rust',
      'typescript',
    ]);
  });
});
