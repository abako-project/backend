export interface TeamMember {
  account_id: string;
  role: string;
  rating?: number;
}

export interface TaskComplexity {
  type: 'Abstract' | 'Days' | 'Weeks';
  value: number;
}

export interface Task {
  id: number;
  complexity: TaskComplexity;
  cost: string;
  dependencies: number[];
  completed: boolean;
  status: TaskStatus;
}

export interface TaskStatus {
  type: 'Pending' | 'Approved' | 'Rejected';
  blockNumber?: number;
}

export interface ScopeRevision {
  version: number;
  proposed_at: number;
  proposed_task_ids: number[];
  approved_task_ids: number[];
  document_hash: string;
}

export interface ProjectScope {
  tasks: Record<number, Task>;
  advance_payment_percentage: number;
  revisions: ScopeRevision[];
}

export interface Project {
  name: string;
  client: string;
  dao_address: string;
  coordinator?: string;
  team_members: TeamMember[];
  status: ProjectStatus;
  calendar_contract?: string;
  scope?: ProjectScope;
  total_cost: string;
  paid_amount: string;
}

export type ProjectStatus =
  | 'Created'
  | 'CoordinatorAssigned'
  | 'TeamAssigned'
  | 'ScopeProposalInProgress'
  | 'ScopePendingClientApproval'
  | 'ScopeAccepted'
  | 'Completed';

export interface ContractCallRequest {
  contractAddress: string;
  method: string;
  data?: any;
}

export interface DeployRequest {
  source: {
    hash: string;
    language: string;
    compiler: string;
    build_info: {
      build_mode: string;
      cargo_contract_version: string;
      rust_toolchain: string;
      wasm_opt_settings: {
        keep_debug_symbols: boolean;
        optimization_passes: string;
      };
    };
  };
  contract: {
    name: string;
    version: string;
    authors: string[];
  };
  image?: any;
  spec: any;
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

export interface CreateMilestoneRequest {
  title: string;
  description?: string;
  budget: number;
  deliveryTime: number;
  role?: string;
  proficiency?: string;
  skills?: string[];
  availability: 'fulltime' | 'parttime' | 'hourly';
}

export interface UpdateMilestoneRequest {
  title: string;
  description?: string;
  budget: number;
  deliveryTime: number;
  role?: string;
  proficiency?: string;
  skills?: string[];
  availability: 'fulltime' | 'parttime' | 'hourly';
}

export interface CreateProposalRequest {
  title: string;
  summary?: string;
  description?: string;
  url?: string;
  projectType?: number;
  budget: number;
  deliveryTime: number;
  calendarContract?: string;
  ratingsContract?: string;
}

export interface UpdateProposalRequest {
  title: string;
  summary?: string;
  description?: string;
  url?: string;
  projectType?: number;
  budget: number;
  deliveryTime: number;
}

export interface ScopeRejectRequest {
  clientResponse?: string;
}

export interface MilestoneRejectRequest {
  rejectionReason?: string;
}

export interface CoordinatorApprovalRequest {
  milestones: CreateMilestoneRequest[];
  advance_payment_percentage: number;
  document_hash: string;
}
