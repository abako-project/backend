#!/bin/sh
set -e

echo "Installing dependencies..."
pnpm install
cd packages/mock-api && pnpm install && cd ../..
cd packages/adapter-api && pnpm install && cd ../..

# Build better-sqlite3 native addon if needed
SQLITE_DIR=$(dirname "$(find node_modules -name 'binding.gyp' -path '*/better-sqlite3/*' 2>/dev/null | head -1)")
if [ -d "$SQLITE_DIR" ] && [ ! -f "$SQLITE_DIR/build/Release/better_sqlite3.node" ]; then
  echo "Compiling better-sqlite3..."
  (cd "$SQLITE_DIR" && npm run build-release --silent)
fi

echo "
  Ready! Run:
    pnpm run dev:mock     Start the backend
    pnpm run test:mock    Run tests (90)
"
