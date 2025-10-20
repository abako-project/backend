#!/bin/bash

# Colors for output
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Stopping infrastructure...${NC}"
echo ""

# Change to script directory
cd "$(dirname "$0")"

# Stop services
docker compose -f docker-compose.dev.yml down

echo ""
echo -e "${RED}Infrastructure stopped${NC}"
echo ""

