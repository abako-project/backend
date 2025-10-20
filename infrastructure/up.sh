#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting development infrastructure...${NC}"
echo ""

# Change to script directory
cd "$(dirname "$0")"

# Start services with Docker Compose
docker compose -f docker-compose.dev.yml up -d --build

echo ""
echo -e "${GREEN}Infrastructure started${NC}"
echo ""
echo -e "${YELLOW}To view logs:${NC}"
echo -e "  ./infrastructure/logs.sh [service]"
echo ""
echo -e "${YELLOW}To stop:${NC}"
echo -e "  ./infrastructure/down.sh"
echo ""

