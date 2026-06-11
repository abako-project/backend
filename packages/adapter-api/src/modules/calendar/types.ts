// Availability levels based on smart contract
export enum AvailabilityLevel {
  NotAvailable = 'NotAvailable',
  PartTime = 'PartTime',
  FullTime = 'FullTime',
  WeeklyHours = 'WeeklyHours'
}

// Request types
export interface SetAvailabilityRequest {
  availability: AvailabilityLevel | { WeeklyHours: number };
}

export interface RegisterWorkerRequest {
  worker: string;
}

export interface RegisterWorkersRequest {
  workers: string[];
}

export interface AdminSetWorkerAvailabilityRequest {
  worker: string;
  availability: AvailabilityLevel | { WeeklyHours: number };
}

export interface IsAvailableQuery {
  worker: string;
  min_hours?: number;
}

export interface GetAvailableWorkersQuery {
  min_hours?: number;
}

// Response types
export interface WorkerAvailability {
  worker: string;
  hours: number;
}

export interface ExtrinsicResponse {
  encodedData: string;
  method: string;
  contractAddress: string;
}

export interface QueryResponse {
  success: boolean;
  method: string;
  contractAddress: string;
  response: any;
}

export interface DeployResponse {
  success: boolean;
  address: string;
  inkVersion: string;
  contractType: string;
}

