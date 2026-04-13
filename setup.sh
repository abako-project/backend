#!/bin/sh
set -e

echo "Installing dependencies..."
pnpm install

echo "Setting up workspace packages..."
cd packages/mock-api && pnpm install && cd ../..
cd packages/adapter-api && pnpm install && cd ../..

echo "Building native modules..."
SQLITE_DIR=$(dirname "$(find node_modules -name 'binding.gyp' -path '*/better-sqlite3/*' 2>/dev/null | head -1)")
if [ -d "$SQLITE_DIR" ] && [ ! -f "$SQLITE_DIR/build/Release/better_sqlite3.node" ]; then
  echo "  Compiling better-sqlite3..."
  (cd "$SQLITE_DIR" && npm run build-release)
else
  echo "  better-sqlite3 ready"
fi

echo ""
echo "Setup complete! Run:"
echo "  pnpm run dev:mock     # start the backend"
echo "  pnpm run test:mock    # run tests"
