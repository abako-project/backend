#!/bin/bash
# Script to pull pre-built Docker images from a registry
# Use this on machines that didn't build the images locally
# The images must be built on the original machine first

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Registry URL (required)
if [ -z "$REGISTRY" ]; then
  echo -e "${RED}ERROR: REGISTRY environment variable is required${NC}"
  echo ""
  echo "Usage:"
  echo "  REGISTRY=registry.example.com/project ./infrastructure/pull-images.sh"
  echo ""
  exit 1
fi

echo -e "${BLUE}Pulling Docker images from registry: $REGISTRY${NC}"
echo -e "${YELLOW}Note: These images must have been built on the original machine${NC}"
echo ""

# Image tags
ZOMBIENET_IMAGE="kreivo-zombienet:e2e"
CONTRACTS_API_IMAGE="contracts-api:e2e"
ADAPTER_API_IMAGE="adapter-api:e2e"
VIRTO_API_IMAGE="virto-api:e2e"

# Pull and tag Zombienet image
echo -e "${YELLOW}Pulling Zombienet image...${NC}"
docker pull "$REGISTRY/$ZOMBIENET_IMAGE"
docker tag "$REGISTRY/$ZOMBIENET_IMAGE" "$ZOMBIENET_IMAGE"
echo -e "${GREEN}✓ Zombienet image ready${NC}"
echo ""

# Pull and tag Contracts API image
echo -e "${YELLOW}Pulling Contracts API image...${NC}"
docker pull "$REGISTRY/$CONTRACTS_API_IMAGE"
docker tag "$REGISTRY/$CONTRACTS_API_IMAGE" "$CONTRACTS_API_IMAGE"
echo -e "${GREEN}✓ Contracts API image ready${NC}"
echo ""

# Pull and tag Adapter API image
echo -e "${YELLOW}Pulling Adapter API image...${NC}"
docker pull "$REGISTRY/$ADAPTER_API_IMAGE"
docker tag "$REGISTRY/$ADAPTER_API_IMAGE" "$ADAPTER_API_IMAGE"
echo -e "${GREEN}✓ Adapter API image ready${NC}"
echo ""

# Pull and tag Virto API image
echo -e "${YELLOW}Pulling Virto API image...${NC}"
docker pull "$REGISTRY/$VIRTO_API_IMAGE"
docker tag "$REGISTRY/$VIRTO_API_IMAGE" "$VIRTO_API_IMAGE"
echo -e "${GREEN}✓ Virto API image ready${NC}"
echo ""

echo -e "${GREEN}All images pulled and tagged successfully!${NC}"
echo ""
echo "Images are now available locally:"
echo "  - $ZOMBIENET_IMAGE"
echo "  - $CONTRACTS_API_IMAGE"
echo "  - $ADAPTER_API_IMAGE"
echo "  - $VIRTO_API_IMAGE"
echo ""
echo -e "${GREEN}You can now run E2E tests with all details: VERBOSE_LEVEL=all ./infrastructure/run-e2e-tests.sh${NC}"
echo -e "${GREEN}You can now run E2E tests with minimal details: VERBOSE_LEVEL=info ./infrastructure/run-e2e-tests.sh${NC}"
echo -e "${GREEN}You can now run E2E tests with no details: VERBOSE_LEVEL=none ./infrastructure/run-e2e-tests.sh${NC}"

