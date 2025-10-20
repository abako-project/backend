# External Dependencies (Git Submodules)

This directory contains all external dependencies of the project as Git submodules.

## Included Submodules

### subskribinto
- **Repository**: https://github.com/virto-network/subskribinto
- **Description**: Rust tool for executing transactions on the Kreivo blockchain
- **Usage**: Used in the zombienet container to deploy contracts and execute extrinsics
- **Compilation**: Requires Rust toolchain (compiled in the Dockerfile)

Only dependencies that are NOT part of the monorepo should be here as submodules.
