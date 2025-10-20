#!/bin/bash
# Script to run E2E tests with necessary infrastructure

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}E2E Test Runner${NC}"
echo ""

# Function to check if a service is ready
check_service() {
  local service_name=$1
  local url=$2
  local max_attempts=60
  local attempt=1

  echo -e "${YELLOW}Waiting for ${service_name} to be ready...${NC}"
  echo -e "${BLUE}[DEBUG] URL: $url${NC}"
  
  while [ $attempt -le $max_attempts ]; do
    RESPONSE=$(curl -s -f "$url" 2>&1)
    CURL_EXIT=$?
    
    if [ $CURL_EXIT -eq 0 ]; then
      echo -e "\n${GREEN}${service_name} is ready${NC}"
      return 0
    fi
    
    # Show debug every 10 attempts
    if [ $((attempt % 10)) -eq 0 ]; then
      echo -e "\n${BLUE}[DEBUG] Attempt $attempt/$max_attempts - curl exit code: $CURL_EXIT${NC}"
      echo -e "${BLUE}[DEBUG] Response: ${RESPONSE:0:100}${NC}"
    fi
    
    echo -n "."
    sleep 2
    attempt=$((attempt + 1))
  done
  
  echo -e "\n${RED}${service_name} did not respond after ${max_attempts} attempts${NC}"
  echo -e "${RED}[DEBUG] Last error: $RESPONSE${NC}"
  return 1
}

# Function to check if zombienet is completely ready
check_zombienet_ready() {
  local max_attempts=180
  local attempt=1
  
  echo -e "${YELLOW}Waiting for Zombienet to deploy contracts...${NC}"
  echo -e "${YELLOW}   (This may take 2-3 minutes)${NC}"
  echo -e "${BLUE}[DEBUG] Starting Zombienet verification...${NC}"
  
  while [ $attempt -le $max_attempts ]; do
    # Get finalized block hash (without jq)
    RESPONSE=$(curl -s -H "Content-Type: application/json" \
      -d '{"id":1, "jsonrpc":"2.0", "method": "chain_getFinalizedHead"}' \
      http://localhost:21000 2>&1)
    
    echo -e "${BLUE}[DEBUG] Attempt $attempt - curl response: ${RESPONSE:0:100}...${NC}"
    
    FINALIZED_BLOCK=$(echo "$RESPONSE" | grep -o '"result":"[^"]*"' | cut -d'"' -f4)
    
    echo -e "${BLUE}[DEBUG] Finalized block hash: $FINALIZED_BLOCK${NC}"
    
    if [ ! -z "$FINALIZED_BLOCK" ] && [ "$FINALIZED_BLOCK" != "null" ]; then
      # Get block number (without jq)
      HEADER_RESPONSE=$(curl -s -H "Content-Type: application/json" \
        -d "{\"id\":1, \"jsonrpc\":\"2.0\", \"method\": \"chain_getHeader\", \"params\": [\"$FINALIZED_BLOCK\"]}" \
        http://localhost:21000 2>&1)
      
      echo -e "${BLUE}[DEBUG] Header response: ${HEADER_RESPONSE:0:100}...${NC}"
      
      BLOCK_NUMBER=$(echo "$HEADER_RESPONSE" | grep -o '"number":"[^"]*"' | cut -d'"' -f4)
      
      echo -e "${BLUE}[DEBUG] Block number (hex): $BLOCK_NUMBER${NC}"
      
      if [ ! -z "$BLOCK_NUMBER" ] && [ "$BLOCK_NUMBER" != "null" ]; then
        # Convert from hex to decimal
        BLOCK_NUM=$(printf "%d" $BLOCK_NUMBER 2>/dev/null || echo "0")
        
        echo -e "${BLUE}[DEBUG] Block number (decimal): $BLOCK_NUM${NC}"
        
        if [ $BLOCK_NUM -gt 15 ]; then
          echo -e "\n${GREEN}Zombienet is ready (finalized block: $BLOCK_NUM)${NC}"
          return 0
        fi
        
        # Show progress every 5 attempts
        if [ $((attempt % 5)) -eq 0 ]; then
          echo -e "\n${YELLOW}   Current block: $BLOCK_NUM / 15 (attempt $attempt/$max_attempts)${NC}"
        fi
      else
        echo -e "${RED}[DEBUG] Could not extract block number${NC}"
      fi
    else
      echo -e "${RED}[DEBUG] Could not extract finalized block hash${NC}"
    fi
    
    echo -n "."
    sleep 2
    attempt=$((attempt + 1))
  done
  
  echo -e "\n${RED}Zombienet was not ready after ${max_attempts} attempts${NC}"
  echo -e "${YELLOW}Check logs: docker compose -f infrastructure/docker-compose.dev.yml logs zombienet${NC}"
  return 1
}

# Check if services are running
echo -e "${BLUE}Checking services...${NC}"

SERVICES_RUNNING=$(docker compose -f "$SCRIPT_DIR/docker-compose.dev.yml" ps --services --filter "status=running" 2>/dev/null | wc -l)

if [ "$SERVICES_RUNNING" -lt 3 ]; then
  echo -e "${YELLOW}Services are not running. Starting infrastructure...${NC}"
  echo ""
  
  cd "$BACKEND_DIR"
  docker compose -f infrastructure/docker-compose.dev.yml up -d
  
  echo ""
  echo -e "${YELLOW}Waiting for services to be ready...${NC}"
  sleep 5
fi

# Check that key services are responding
echo -e "${BLUE}Checking basic connectivity...${NC}"

# Zombienet is a JSON-RPC server, we verify with an RPC request
echo -e "${YELLOW}Waiting for Zombienet RPC to be ready...${NC}"
echo -e "${BLUE}[DEBUG] URL: http://localhost:21000${NC}"

for i in {1..30}; do
  RPC_RESPONSE=$(curl -s -H "Content-Type: application/json" \
    -d '{"id":1, "jsonrpc":"2.0", "method": "system_health"}' \
    http://localhost:21000 2>&1)
  
  if echo "$RPC_RESPONSE" | grep -q '"result"'; then
    echo -e "\n${GREEN}Zombienet RPC is ready${NC}"
    break
  fi
  
  if [ $((i % 10)) -eq 0 ]; then
    echo -e "\n${BLUE}[DEBUG] Attempt $i/30 - Response: ${RPC_RESPONSE:0:100}${NC}"
  fi
  
  echo -n "."
  sleep 2
done

if ! echo "$RPC_RESPONSE" | grep -q '"result"'; then
  echo -e "\n${RED}Zombienet RPC did not respond${NC}"
  echo -e "${RED}[DEBUG] Last response: $RPC_RESPONSE${NC}"
  exit 1
fi

# Deep verification of Zombienet (deployed contracts)
check_zombienet_ready || exit 1

# Check other services
check_service "Virto API" "http://localhost:3000/api/health" || {
  echo -e "${YELLOW}Virto API does not have /health endpoint, checking port...${NC}"
  if command -v nc &> /dev/null; then
    nc -z localhost 3000 || exit 1
  else
    curl -s http://localhost:3000 > /dev/null || exit 1
  fi
  echo -e "${GREEN}Port 3000 is open${NC}"
}
check_service "Contracts API" "http://localhost:3010/health" || exit 1

echo ""
echo -e "${GREEN}All infrastructure is ready${NC}"
echo ""

# Go to package directory
cd "$BACKEND_DIR/packages/adapter-api"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Installing dependencies...${NC}"
  npm install --legacy-peer-deps
  echo ""
fi

# Run tests
echo -e "${BLUE}Running E2E tests...${NC}"
echo ""

npm run test:e2e "$@"

TEST_EXIT_CODE=$?

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}Tests completed successfully${NC}"
else
  echo -e "${RED}Tests failed${NC}"
fi

exit $TEST_EXIT_CODE

