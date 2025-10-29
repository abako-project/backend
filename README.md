# Kunveno Backend - Monorepo

This is the backend monorepo for the Kunveno project (Abako), which includes all the APIs and services necessary for the system's operation.



> For detailed testing instructions, see [TESTING_GUIDE.md](./TESTING_GUIDE.md).

## Project Structure

```
backend/
├── packages/              # Main monorepo packages
│   ├── adapter-api/      # Adapter API for integrations
│   ├── contracts-api/    # API to interact with ink! contracts (papi-ink)
│   └── virto-api/        # Main Virto API / VOS Mock (virto-demo)
├── external/             # External dependencies as Git submodules
│   └── subskribinto/     # Tool for blockchain transactions
├── lerna.json            # Lerna configuration
├── pnpm-workspace.yaml   # pnpm workspace configuration
└── package.json          # Root dependencies
```

## External Dependencies Management

External dependencies are now managed as **Git submodules** in the `external/` directory.

### Initial setup

When you clone this repository for the first time:

```bash
# Option 1: Clone with submodules
git clone --recurse-submodules <repo-url>

# Option 2: Initialize submodules after cloning
git clone <repo-url>
cd backend
git submodule update --init --recursive
```

### Update submodules

```bash
# Update all submodules
git submodule update --remote --merge

# Update a specific submodule
cd external/subskribinto
git pull origin main
cd ../..
git add external/subskribinto
git commit -m "Update subskribinto submodule"
```

For more details, see [external/README.md](./external/README.md).

## Installation and Setup

### Prerequisites

- Node.js >= 22.x
- pnpm >= 9.x
- Docker and Docker Compose (for development/testing environments)

### Installation

```bash
# Install dependencies
pnpm install

# Install dependencies for all packages
pnpm install --recursive
```

## Development

### Available commands

```bash
# Run all packages in development mode
pnpm run dev

# Run a specific package
pnpm --filter adapter-api dev
pnpm --filter contracts-api dev
pnpm --filter virto-api dev

# Build all packages
pnpm run build
```

### End-to-End (E2E) Tests

E2E tests run complete flows against real infrastructure (Zombienet, contracts, APIs).

```bash
# Start infrastructure (if not running)
npm run infra:up

# Run complete e2e test (projects - complete flow)
npm run test:e2e

# Run ALL e2e tests
cd packages/adapter-api
npm run test:e2e:all

# Run individual tests
npm run test:e2e:auth      # Authentication only
npm run test:e2e:calendar  # Calendar only

# Stop infrastructure
npm run infra:down

# View logs for a specific service
./infrastructure/logs.sh zombienet
./infrastructure/logs.sh contracts-api
./infrastructure/logs.sh virto-api
./infrastructure/logs.sh adapter-api
```

## Monorepo Management

This project uses:
- **Lerna**: For version management and publishing
- **pnpm workspaces**: For shared dependency management
- **Git submodules**: For external dependencies

### Adding a new package

```bash
cd packages
mkdir my-new-package
cd my-new-package
npm init -y
# Configure your package...
cd ../..
pnpm install
```

### Package references

Packages can reference each other using:

```json
{
  "dependencies": {
    "@kunveno/adapter-api": "workspace:*"
  }
}
```

### Working with submodules

⚠️ **Important**: Do not modify submodules directly. If you need changes in a submodule:

1. Make the changes in the original repository
2. Create a PR in that repository
3. Once merged, update the submodule here:
   ```bash
   cd external/<submodule>
   git pull origin main
   cd ../..
   git add external/<submodule>
   git commit -m "Update <submodule> to version X"
   ```

## Testing

This project includes comprehensive testing documentation and end-to-end tests covering the complete project lifecycle.

### Quick Test Run

```bash
# Start infrastructure
./infrastructure/up.sh

# Run all E2E tests
cd packages/adapter-api
npm run test:e2e:all
```

### Complete Testing Guide

For detailed testing instructions, including:
- Test environment setup
- Module-by-module testing (Auth, Calendar, Projects)
- Complete end-to-end flow examples
- API reference with request/response examples
- Troubleshooting guide

See the **[Testing Guide](./TESTING_GUIDE.md)**.

### Test Coverage

The E2E tests cover:
- ✅ WebAuthn authentication (Pass Pallet)
- ✅ DAO membership registration (Communities)
- ✅ Calendar contract deployment and worker registration
- ✅ Availability management
- ✅ Project contract deployment
- ✅ Automatic coordinator assignment (matching algorithm)
- ✅ Automatic team assignment (matching algorithm)
- ✅ Scope proposal with milestones
- ✅ Scope approval (governance)
- ✅ Task completion (milestone-based payouts)
- ✅ Project completion with ratings (reputation system)

## Architecture

### Service Overview

```
┌──────────────────────────────────────┐
│       adapter-api (Port 4000)        │  ← Main API orchestrator
│  ┌────────────┬──────────┬─────────┐ │
│  │   Auth     │ Calendar │Projects │ │
│  └────────────┴──────────┴─────────┘ │
└───────┬──────────────────┬───────────┘
        │                  │
        ▼                  ▼
┌───────────────┐   ┌──────────────────┐
│   virto-api   │   │  contracts-api   │
│  (Port 3000)  │   │   (Port 3010)    │
│               │   │                  │
│ VOS Mock /    │   │ Ink! v5 SDK for  │
│ federate_server│  │ smart contracts  │
└───────┬───────┘   └────────┬─────────┘
        │                    │
        └────────┬───────────┘
                 ▼
        ┌─────────────────┐
        │   Zombienet     │  ← Kreivo testnet
        │  (Port 21000)   │     (Kusama)
        └─────────────────┘
```

### Key Components

- **adapter-api**: NestJS API that exposes REST endpoints for authentication, calendar management, and project operations
- **contracts-api**: Express service for interacting with Ink! v5 smart contracts using polkadot-api
- **virto-api**: NestJS mock of Virto Operating System (VOS), handles Pass Pallet registration and Communities operations
- **zombienet**: Local Kreivo parachain testnet for development and testing

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or contributions:
1. Check the [Testing Guide](./TESTING_GUIDE.md) troubleshooting section
2. Review service logs: `./infrastructure/logs.sh <service>`
3. Inspect contract metadata in `packages/contracts-api/.papi/contracts/`
4. Review E2E tests in `packages/adapter-api/test/`
