#!/bin/bash
# Script to pre-build all Docker images for E2E testing
# These images must be built on this machine to ensure zombienet works correctly
# Other machines should pull these images or build them locally before running tests

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Optional: Set REGISTRY variable to push images after building
# REGISTRY should be the namespace/prefix where images will be pushed
# The script will append each image name automatically
# Examples:
#   - Docker Hub: REGISTRY=bavb (creates bavb/kreivo-zombienet:e2e, bavb/contracts-api:e2e, etc.)
#   - Private registry: REGISTRY=registry.example.com/project
#   - GitHub Container Registry: REGISTRY=ghcr.io/username/project
#   - GitLab Registry: REGISTRY=registry.gitlab.com/group/project
REGISTRY="${REGISTRY:-}"

echo -e "${BLUE}Building Docker images for E2E tests${NC}"
echo -e "${YELLOW}Note: Images must be built on this machine for zombienet to work correctly${NC}"
if [ ! -z "$REGISTRY" ]; then
  echo -e "${YELLOW}Registry: $REGISTRY (images will be pushed after building)${NC}"
fi
echo ""

cd "$BACKEND_DIR"

# Ensure buildx is available and create builder if needed
if ! docker buildx version &>/dev/null; then
  echo -e "${YELLOW}docker buildx not available, using standard docker build${NC}"
  USE_BUILDX=false
else
  USE_BUILDX=true
  # Create a builder instance if it doesn't exist
  if ! docker buildx inspect e2e-builder &>/dev/null; then
    echo -e "${YELLOW}Creating docker buildx builder...${NC}"
    docker buildx create --name e2e-builder --use 2>/dev/null || true
  fi
fi

# Image tags
ZOMBIENET_IMAGE="kreivo-zombienet:e2e"
CONTRACTS_API_IMAGE="contracts-api:e2e"
ADAPTER_API_IMAGE="adapter-api:e2e"
VIRTO_API_IMAGE="virto-api:e2e"

# Function to build an image
build_image() {
  local dockerfile=$1
  local tag=$2
  local service_name=$3
  
  echo -e "${YELLOW}Building ${service_name} image...${NC}"
  
  if [ ! -z "$REGISTRY" ]; then
    # If registry is set, build locally first, then tag and push
    if [ "$USE_BUILDX" = true ]; then
      # Build locally with buildx
      docker buildx build \
        --file "$dockerfile" \
        --tag "$tag" \
        --load \
        .
      # Tag and push to registry
      docker tag "$tag" "$REGISTRY/$tag"
      docker push "$REGISTRY/$tag"
    else
      # Standard docker build + tag + push
      docker build -f "$dockerfile" -t "$tag" .
      docker tag "$tag" "$REGISTRY/$tag"
      docker push "$REGISTRY/$tag"
    fi
  else
    # Local build only
    if [ "$USE_BUILDX" = true ]; then
      docker buildx build \
        --file "$dockerfile" \
        --tag "$tag" \
        --load \
        .
    else
      docker build -f "$dockerfile" -t "$tag" .
    fi
  fi
  
  echo -e "${GREEN}✓ ${service_name} image built${NC}"
  if [ ! -z "$REGISTRY" ]; then
    echo -e "${GREEN}✓ ${service_name} image pushed to $REGISTRY/$tag${NC}"
  fi
  echo ""
}

# Build all images
build_image "infrastructure/Dockerfile" "$ZOMBIENET_IMAGE" "Zombienet"
build_image "packages/contracts-api/Dockerfile" "$CONTRACTS_API_IMAGE" "Contracts API"
build_image "packages/adapter-api/Dockerfile" "$ADAPTER_API_IMAGE" "Adapter API"
build_image "packages/virto-api/Dockerfile" "$VIRTO_API_IMAGE" "Virto API"

echo -e "${GREEN}All images built successfully!${NC}"
echo ""
echo "Local images:"
echo "  - $ZOMBIENET_IMAGE"
echo "  - $CONTRACTS_API_IMAGE"
echo "  - $ADAPTER_API_IMAGE"
echo "  - $VIRTO_API_IMAGE"

if [ ! -z "$REGISTRY" ]; then
  echo ""
  echo "Registry images:"
  echo "  - $REGISTRY/$ZOMBIENET_IMAGE"
  echo "  - $REGISTRY/$CONTRACTS_API_IMAGE"
  echo "  - $REGISTRY/$ADAPTER_API_IMAGE"
  echo "  - $REGISTRY/$VIRTO_API_IMAGE"
  echo ""
  echo "To use these images on other machines, run:"
  echo "  REGISTRY=$REGISTRY ./infrastructure/pull-images.sh"
fi

