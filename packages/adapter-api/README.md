# Adapter API

## Requirements

- Node.js version 22 or higher
- MongoDB 7.0 or higher

This module provides endpoints to interact with ink!-based project management smart contracts.

## Database Configuration

The application requires a MongoDB database connection. Configure the connection using the `MONGODB_URI` environment variable:

```bash
MONGODB_URI=mongodb://admin:admin123@localhost:27017/abako?authSource=admin
```

## DAO Configuration

Configure the default DAO address for project deployments:

```bash
DAO_ADDRESS=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
```

### Docker Compose Setup

When using Docker Compose, MongoDB is automatically configured with:
- **Username:** admin
- **Password:** admin123
- **Database:** abako
- **Port:** 27017
- **Container:** abako-mongodb

The connection is established automatically when the services start.

## Available Endpoints

### Contract Method Calls

#### POST /call/:contractAddress/:method
Calls a specific method of the projects contract (write methods).

**Parameters:**
- `contractAddress`: Contract address (SS58 format)
- `method`: Method to call

**Body (optional):**
```json
{
  "data": {
    // Method-specific parameters
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/call/5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY/assign_coordinator \
  -H "Content-Type: application/json" \
  -d '{"data": {}}'
```

#### GET /query/:contractAddress/:method
Gets information from a contract method (read-only methods).

**Example:**
```bash
curl "http://localhost:3000/query/5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY/get_project_info"
```

### Contract Deployment

#### POST /deploy/:version
Deploys a new projects contract.

**Body:**
```json
{
  "source": {
    "hash": "0xb1e35aa9e966c669f8d947548df0ff7e9e3a09feb949fd9cb01d5659f21b084d",
    "language": "ink! 5.1.1",
    "compiler": "rustc 1.89.0",
    "build_info": {
      "build_mode": "Release",
      "cargo_contract_version": "5.0.3",
      "rust_toolchain": "stable-x86_64-unknown-linux-gnu",
      "wasm_opt_settings": {
        "keep_debug_symbols": false,
        "optimization_passes": "Z"
      }
    }
  },
  "contract": {
    "name": "projects",
    "version": "0.1.0",
    "authors": ["[your_name] <[your_email]>"]
  },
  "spec": {
    // Contract ABI
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/deploy/v6 \
  -H "Content-Type: application/json" \
  -d '{"source": {...}, "contract": {...}, "spec": {...}}'
```

## Supported Methods

### Write Methods
- `assign_coordinator`: Assigns a coordinator to the project
- `assign_team`: Assigns team members
- `mark_completed`: Marks the project as completed
- `set_calendar_contract`: Sets the calendar contract
- `propose_scope`: Proposes the project scope
- `approve_scope`: Approves the proposed scope
- `complete_task`: Marks a task as completed

### Read Methods
- `get_project_info`: Gets basic project information
- `get_team`: Gets the list of team members
- `get_scope_info`: Gets project scope information
- `get_task`: Gets a specific task
- `get_task_completion_status`: Checks the completion status of a task
- `get_all_tasks`: Gets all project tasks

## Response

All endpoints return an object with the following structure:

```json
{
  "extrinsic": "0x...",
  "method": "method_name",
  "contractAddress": "contract_address"
}
```

The `extrinsic` field contains the extrinsic ready to be signed and sent to the blockchain.

## Validations

- Contract addresses must be 48 characters long and start with '5'
- Methods must be in the list of supported methods
- Input data is validated according to the method type

## Polkadot Integration

The module uses the Polkadot API to generate extrinsics compatible with the Kreivo network. Generated extrinsics can be signed and sent using any Polkadot-compatible client.
