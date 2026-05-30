export type DeveloperProficiency = 'junior' | 'mid-level' | 'senior';

export enum DeveloperAvailability {
  NotAvailable = 'NotAvailable',
  PartTime = 'PartTime',
  FullTime = 'FullTime',
  WeeklyHours = 'WeeklyHours'
}

export interface Developer {
  id: number;
  userId?: string | null;
  email?: string | null;
  name: string;
  githubUsername: string;
  portfolioUrl?: string;
  bio: string;
  background: string;
  proficiency: DeveloperProficiency;
  role?: string;
  location: string;
  availability: DeveloperAvailability;
  languages: string[];
  skills: string[];
  availableHoursPerWeek?: number;
  proficiencyId?: number;
  createdAt: number;
  updatedAt: number;
  consultantProjects?: string[];
}


export interface CreateDeveloperRequest {
    userId?: string;
    email?: string;
    name: string;
    githubUsername: string;
    portfolioUrl?: string;
    image?: File; // multipart/form-data
  }
  
  export interface UpdateDeveloperRequest {
    userId?: string;
    email?: string;
    name: string;
    githubUsername: string;
    portfolioUrl?: string;
    bio: string;
    background: string;
    proficiency: DeveloperProficiency;
    role?: string;
    location: string;
    availability: DeveloperAvailability;
    languages: string[];
    skills: string[];
    availableHoursPerWeek?: number;
    image?: File; // multipart/form-data
  }
