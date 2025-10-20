# Kunveno Backend - Monorepo

This is the backend monorepo for the Kunveno project, which includes all the APIs and services necessary for the system's operation.

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
