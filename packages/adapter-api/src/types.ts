/**
 * Tipos TypeScript para las llamadas al backend
 * 
 * Este archivo contiene las definiciones de tipos para:
 * - Datos enviados en las requests (Request Types)
 * - Datos recibidos en las responses (Response Types)
 * - Entidades del dominio (Entity Types)
 */

// ============================================================================
// ENTIDADES DEL DOMINIO
// ============================================================================


export interface Project {
  id: number;
  title: string;
  description?: string;
  summary?: string;
  projectTypeId?: number;
  state: string;
  url?: string;
  budgetId: number;
  deliveryTimeId: number;
  deliveryDate: number;
  proposalRejectionReason?: string;
  clientId: number;
  consultantId?: number;
  createdAt: number;
  updatedAt: number;
  client?: string;
  consultant?: string;
  objectives?: string[];
  constraints?: string[];
  milestones?: string[];
  comments?: string[];
  budget?: string;
  deliveryTime?: string;
  projectType?: string;
}

export interface Milestone {
  id: number;
  title: string;
  description?: string;
  budget: number;
  deliveryTimeId: number;
  deliveryDate: number;
  roleId?: number;
  proficiencyId?: number;
  displayOrder: number;
  projectId: number;
  neededFullTimeDeveloper: boolean;
  neededPartTimeDeveloper: boolean;
  neededHourlyDeveloper: boolean;
  developerId?: number;
  state: string;
  createdAt: number;
  updatedAt: number;
  deliveryTime?: string;
  role?: string;
  skills?: string[];
  proficiency?: string;
  developer?: string;
}


// ============================================================================
// TIPOS DE PROYECTOS
// ============================================================================

export interface CreateProposalRequest {
  title: string;
  summary?: string;
  description?: string;
  url?: string;
  projectTypeId?: number;
  budgetId: number;
  deliveryTimeId: number;
  deliveryDate: string; // ISO date string
}

export interface UpdateProposalRequest {
  title: string;
  summary?: string;
  description?: string;
  url?: string;
  projectTypeId?: number;
  budgetId: number;
  deliveryTimeId: number;
  deliveryDate: string; // ISO date string
}

export interface ScopeSubmitRequest {
  consultantComment?: string;
}

export interface ScopeAcceptRequest {
  clientResponse?: string;
}

export interface ScopeRejectRequest {
  clientResponse?: string;
}

export interface RejectProposalRequest {
  proposalRejectionReason?: string;
}

export interface SetConsultantRequest {
  consultantId: number;
}

// ============================================================================
// TIPOS DE OBJETIVOS
// ============================================================================

export interface CreateObjectiveRequest {
  description: string;
}

// ============================================================================
// TIPOS DE CONSTRAINTS
// ============================================================================

export interface CreateConstraintRequest {
  description: string;
}

// ============================================================================
// TIPOS DE MILESTONES
// ============================================================================

export interface CreateMilestoneRequest {
  title: string;
  description?: string;
  budget: number;
  deliveryTimeId: number;
  deliveryDate: string; // ISO date string
  roleId?: number;
  proficiencyId?: number;
  skills?: number[];
  availability: 'fulltime' | 'parttime' | 'hourly';
}

export interface UpdateMilestoneRequest {
  title: string;
  description?: string;
  budget: number;
  deliveryTimeId: number;
  deliveryDate: string; // ISO date string
  roleId?: number;
  proficiencyId?: number;
  skills?: number[];
  availability: 'fulltime' | 'parttime' | 'hourly';
}

export interface AssignDeveloperRequest {
  developerId: number;
}

export interface DeveloperAcceptOrRejectRequest {
  comment?: string;
  accept: 'accept' | 'reject';
}

export interface SubmitMilestoneRequest {
  documentation?: string;
  links?: string;
}

export interface ClientAcceptOrRejectSubmissionRequest {
  comment?: string;
  accept: 'accept' | 'reject';
}

export interface CreateClientHistoryCommentRequest {
  comment: string;
}

export interface CreateConsultantHistoryCommentRequest {
  comment: string;
}

// ============================================================================
// TIPOS DE RESPUESTAS DE ERROR
// ============================================================================

export interface ErrorResponse {
  error: boolean;
  message: string;
  details?: string;
  stack?: string;
  code?: string;
}

export interface ValidationError {
  message: string;
  field?: string;
}

export interface ValidationErrorResponse {
  error: boolean;
  errors: ValidationError[];
}

// ============================================================================
// ENDPOINTS API - Mapeo de rutas y tipos
// ============================================================================

/**
 * Mapeo de endpoints con sus tipos de request y response
 */
export interface APIEndpoints {


  // ========== PROJECTS ==========
  'GET /projects': {
    request: void;
    response: { projects: Project[] }; // Rendered view
  };
  'POST /projects': {
    request: CreateProposalRequest;
    response: void; // Redirect
  };
  'GET /projects/:projectId': {
    request: void;
    response: { project: Project }; // Rendered view
  };
  'PUT /projects/:projectId': {
    request: UpdateProposalRequest;
    response: void; // Redirect
  };
  'DELETE /projects/:projectId': {
    request: void;
    response: void; // Redirect
  };
  'PUT /projects/:projectId/proposal_submit': {
    request: void;
    response: void; // Redirect
  };
  'PUT /projects/:projectId/proposal_reject': {
    request: RejectProposalRequest;
    response: void; // Redirect
  };
  'PUT /projects/:projectId/proposal_approve': {
    request: void;
    response: void; // Redirect
  };
  'PUT /projects/:projectId/scopeSubmit': {
    request: ScopeSubmitRequest;
    response: void; // Redirect
  };
  'PUT /projects/:projectId/scopeAccept': {
    request: ScopeAcceptRequest;
    response: void; // Redirect
  };
  'PUT /projects/:projectId/scopeReject': {
    request: ScopeRejectRequest;
    response: void; // Redirect
  };
  'POST /projects/:projectId/consultant': {
    request: SetConsultantRequest;
    response: void; // Redirect
  };
  'GET /projects/:projectId/escrow': {
    request: void;
    response: { project: Project }; // Rendered view
  };
  'GET /projects/:projectId/start': {
    request: void;
    response: void; // Redirect
  };

  // ========== MILESTONES ==========
  'POST /projects/:projectId/milestones': {
    request: CreateMilestoneRequest;
    response: void; // Redirect
  };
  'PUT /projects/:projectId/milestones/:milestoneId': {
    request: UpdateMilestoneRequest;
    response: void; // Redirect
  };
  'DELETE /projects/:projectId/milestones/:milestoneId': {
    request: void; jjjm
    response: void; // Redirect
  };
  'PUT /projects/:projectId/milestones/swaporder/:id1/:id2': {
    request: void;
    response: void; // Redirect
  };
  'POST /projects/:projectId/milestones/:milestoneId/developer': {
    request: AssignDeveloperRequest;
    response: void; // Redirect
  };
  'PUT /projects/:projectId/milestones/:milestoneId/acceptOrRejectAssignation': {
    request: DeveloperAcceptOrRejectRequest;
    response: void; // Redirect
  };
  'PUT /projects/:projectId/milestones/:milestoneId/submitMilestone': {
    request: SubmitMilestoneRequest;
    response: void; // Redirect
  };
  'PUT /projects/:projectId/milestones/:milestoneId/acceptOrRejectSubmission': {
    request: ClientAcceptOrRejectSubmissionRequest;
    response: void; // Redirect
  };
  'PUT /projects/:projectId/milestones/:milestoneId/rollbackSubmission': {
    request: void;
    response: void; // Redirect
  };
  'POST /projects/:projectId/milestones/:milestoneId/history/clientComments': {
    request: CreateClientHistoryCommentRequest;
    response: void; // Redirect
  };
  'POST /projects/:projectId/milestones/:milestoneId/history/consultantComments': {
    request: CreateConsultantHistoryCommentRequest;
    response: void; // Redirect
  };

  // ========== CLIENTS ==========
  'GET /clients': {
    request: void;
    response: { clients: Client[] }; // Rendered view
  };
  'GET /clients/:clientId': {
    request: void;
    response: { client: Client }; // Rendered view
  };
  'PUT /clients/:clientId': {
    request: UpdateClientRequest;
    response: void; // Redirect
  };
  'GET /clients/:clientId/attachment': {
    request: void;
    response: Blob | Buffer; // Image binary
  };
  'GET /clients/:clientId/projects': {
    request: void;
    response: { projects: Project[] }; // Rendered view
  };

  // ========== DEVELOPERS ==========
  'GET /developers': {
    request: void;
    response: { developers: Developer[] }; // Rendered view
  };
  'GET /developers/:developerId': {
    request: void;
    response: { developer: Developer }; // Rendered view
  };
  'PUT /developers/:developerId': {
    request: UpdateDeveloperRequest;
    response: void; // Redirect
  };
  'GET /developers/:developerId/attachment': {
    request: void;
    response: Blob | Buffer; // Image binary
  };
  'GET /developers/:developerId/projects': {
    request: void;
    response: { projects: Project[] }; // Rendered view
  };
  'GET /developers/:developerId/milestones': {
    request: void;
    response: { projects: Project[] }; // Rendered view
  };


  // ========== DASHBOARD ==========
  'GET /dashboard': {
    request: void;
    response: any; // Rendered view
  };
  'GET /dashboard/projects': {
    request: void;
    response: { projects: Project[] }; // Rendered view
  };
  'GET /dashboard/milestones': {
    request: void;
    response: { projects: Project[] }; // Rendered view
  };

  // ========== PAYMENTS ==========
  'GET /payments': {
    request: void;
    response: any; // Rendered view
  };
}
