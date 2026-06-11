// Availability levels based on smart contract
export enum AvailabilityLevel {
  NotAvailable = 'NotAvailable',
  FullTime = 'FullTime',
  WeeklyHours = 'WeeklyHours',
  PermanentWeeklyHours = 'PermanentWeeklyHours',
}

export type AvailabilityInput =
  | AvailabilityLevel.FullTime
  | { WeeklyHours: number }
  | { PermanentWeeklyHours: number }
  | { type: 'WeeklyHours' | 'PermanentWeeklyHours'; value: number }
  | { weeks: number[]; permanentWeeklyHours?: number };

// Request types
export interface SetAvailabilityRequest {
  availability: AvailabilityInput;
}

export interface RegisterWorkerRequest {
  worker: string;
}

export interface RegisterWorkersRequest {
  workers: string[];
}

export interface AdminSetWorkerAvailabilityRequest {
  worker: string;
  availability: AvailabilityInput;
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
