# Changelog

## [Unreleased]

### Added
- **Project-Contract Linking**: Projects are now linked to smart contracts via `contractAddress` field in MongoDB
- **Automatic Coordinator Assignment**: Coordinators are automatically assigned when a project is deployed
- **Coordinator Approval/Rejection Flow**: 
  - `POST /projects/:contractAddress/propose_scope` - Coordinator approves project by creating milestones and proposing scope atomically
  - `POST /projects/:contractAddress/coordinator_reject` - Coordinator rejects project with reason stored in database
- **Milestone Management**: Milestones are now linked to projects via `contractAddress` instead of `projectId`
- **Default Contract Addresses**: 
  - Ratings contract: `JEnwSomCEqPrh5HcEzPFNKVfrfoFjVLR6JVJvqKaTfba4zY`
  - Calendar contract: `Cfqrpkb3Fs17DBpQR5UmBq3bDzaDTnFe89RK9EwZvPWtJpr`
  - Automatically deployed at blockchain initialization and shared by all projects
- **Project Retrieval**: `GET /projects/:contractAddress` endpoint to fetch project data from MongoDB
- **Event-based Coordinator Extraction**: Coordinator address is now extracted from `CoordinatorAssigned` event Topic 2 with SS58 encoding

### Changed
- **Project Schema** (`project.schema.ts`):
  - Added `contractAddress` (unique, sparse index)
  - Added `coordinatorApprovalStatus` and `coordinatorRejectionReason`
  - Added `calendarContract` reference
- **Milestone Schema** (`milestone.schema.ts`):
  - Changed `projectId: number` to `contractAddress: string`
  - Changed `role`, `proficiency` from numbers to strings
  - Ensured `skills` is explicitly an array of strings
- **Project Deployment** (`projects.service.ts`):
  - Now saves complete project information to MongoDB on deployment
  - Automatically uses default ratings and calendar contracts
- **Coordinator Approval Process**:
  - Single atomic operation that creates milestones in MongoDB and proposes scope to smart contract
  - Milestones are converted to tasks for blockchain storage
  - `proposeScope` method is now private (internal use only)
- **API Types** (`types.ts`):
  - `CreateProposalRequest`: Uses `budget`, `deliveryTime`, `projectType` as numbers (not IDs)
  - `CreateMilestoneRequest`: Uses `role`, `proficiency` as strings, `skills` as string array
  - `CoordinatorApproveRequest`: Added `milestones`, `advance_payment_percentage`, `document_hash`
- **Environment Variables**:
  - `DEFAULT_RATINGS_CONTRACT` - Default ratings contract address
  - `DEFAULT_CALENDAR_CONTRACT` - Default calendar contract address
  - `RATINGS_APP_ID=2` - Ratings contract app ID for deployment

### Fixed
- **Coordinator Assignment Bug**: Fixed event data extraction using `ss58Encode` for proper address decoding
- **Contract Dependencies**: Ensured correct deployment order (ratings → calendar → project) with proper address passing
- **Milestone Field Types**: Corrected data types across schema, services, and controllers for consistency
- **Duplicate Index Warning**: Removed explicit index creation as `unique: true` already creates an index
- **Developer Service**: Updated `getMilestones` to query by `contractAddress` instead of `projectId`

### Removed
- **Public `proposeScope` Endpoint**: Now handled internally via coordinator approval
- **Manual Coordinator Assignment Test**: Removed as assignment is now automatic
- **Milestone Creation Endpoint Documentation**: Removed standalone milestone creation as it should be done via coordinator approval
- **Contract Deployment in Tests**: Ratings and Calendar contracts no longer deployed in E2E tests (use defaults)

### Technical Details
- **Calendar Service** (`calendar.service.ts`):
  - `deployContract` now accepts optional `ratingsContract` parameter
- **E2E Tests** (`projects.e2e-spec.ts`):
  - Updated to use default contract addresses
  - Added tests for coordinator approval and rejection flows
  - Removed redundant contract deployment steps
  - Simplified project deployment (no need to pass contract addresses)

### API Documentation
- **Swagger Documentation**: Updated all endpoints to reflect new architecture
  - Project deployment now documents automatic use of default contracts
  - Coordinator approval/rejection endpoints fully documented
  - Milestone fields updated to show string types for role, proficiency, and skills
  - Calendar endpoints document shared DAO contract model

---

## Migration Notes

### Environment Setup
Ensure the following environment variables are set:
```bash
DEFAULT_RATINGS_CONTRACT=JEnwSomCEqPrh5HcEzPFNKVfrfoFjVLR6JVJvqKaTfba4zY
DEFAULT_CALENDAR_CONTRACT=Cfqrpkb3Fs17DBpQR5UmBq3bDzaDTnFe89RK9EwZvPWtJpr
```

