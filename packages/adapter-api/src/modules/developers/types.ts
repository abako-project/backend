export type DeveloperRole = 'junior' | 'mid-level' | 'senior';

export enum DeveloperAvailability {
  NotAvailable = 'NotAvailable',
  PartTime = 'PartTime',
  FullTime = 'FullTime',
  WeeklyHours = 'WeeklyHours'
}

export interface Developer {
  id: number;
  email: string;
  name: string;
  githubUsername: string;
  portfolioUrl?: string;
  bio: string;
  background: string;
  role: DeveloperRole;
  location: string;
  availability: DeveloperAvailability;
  languages: string[];
  skills: string[];
  availableHoursPerWeek?: number;
  proficiencyId?: number;
  createdAt: number;
  updatedAt: number;
  proficiency?: string;
  consultantProjects?: string[];
}


export interface CreateDeveloperRequest {
    email: string;
    name: string;
    githubUsername: string;
    portfolioUrl?: string;
    image?: File; // multipart/form-data
  }
  
  export interface UpdateDeveloperRequest {
    name: string;
    email: string;
    githubUsername: string;
    portfolioUrl?: string;
    bio: string;
    background: string;
    role: DeveloperRole;
    location: string;
    availability: DeveloperAvailability;
    languages: string[];
    skills: string[];
    availableHoursPerWeek?: number;
    image?: File; // multipart/form-data
  }
