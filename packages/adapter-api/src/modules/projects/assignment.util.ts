export function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase();
}

export function normalizeSkills(skills: string[]): string[] {
  return [...new Set(skills.map(normalizeSkill).filter(Boolean))];
}
