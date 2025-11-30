#!/bin/bash

# =============================================================================
# Docker Build Script for Auth System Service
# =============================================================================
# This script builds and optionally pushes the Docker image for the Auth System
# service to the container registry.
#
# Usage:
#   ./build-docker.sh              # Build only
#   ./build-docker.sh --push       # Build and push
#   ./build-docker.sh --no-cache   # Build without cache
# =============================================================================

set -e  # Exit on error

# Configuration
IMAGE_NAME="elano/auth-system-service"
VERSION="latest"
DOCKERFILE="Dockerfile"
BUILD_CONTEXT="."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
PUSH=false
NO_CACHE=""

for arg in "$@"; do
    case $arg in
        --push)
            PUSH=true
            shift
            ;;
        --no-cache)
            NO_CACHE="--no-cache"
            shift
            ;;
        --version=*)
            VERSION="${arg#*=}"
            shift
            ;;
        --help)
            echo "Usage: ./build-docker.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --push              Push image to registry after build"
            echo "  --no-cache          Build without using cache"
            echo "  --version=VERSION   Specify image version (default: latest)"
            echo "  --help              Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown argument: $arg${NC}"
            exit 1
            ;;
    esac
done

# Print header
echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}Building Auth System Docker Image${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""

# Check if Docker is running
echo -e "${YELLOW}Checking Docker...${NC}"
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"
echo ""

# Check if Dockerfile exists
if [ ! -f "$DOCKERFILE" ]; then
    echo -e "${RED}Error: Dockerfile not found${NC}"
    exit 1
fi

# Build the image
echo -e "${YELLOW}Building Docker image...${NC}"
echo -e "Image: ${BLUE}${IMAGE_NAME}:${VERSION}${NC}"
echo ""

docker build \
    $NO_CACHE \
    -t "${IMAGE_NAME}:${VERSION}" \
    -t "${IMAGE_NAME}:$(date +%Y%m%d-%H%M%S)" \
    -f "$DOCKERFILE" \
    "$BUILD_CONTEXT"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Docker image built successfully${NC}"
else
    echo -e "${RED}✗ Docker build failed${NC}"
    exit 1
fi

# Display image info
echo ""
echo -e "${YELLOW}Image details:${NC}"
docker images "${IMAGE_NAME}:${VERSION}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
echo ""

# Run security scan with Trivy (if installed)
if command -v trivy &> /dev/null; then
    echo -e "${YELLOW}Running security scan with Trivy...${NC}"
    trivy image --severity HIGH,CRITICAL "${IMAGE_NAME}:${VERSION}"
    echo ""
else
    echo -e "${YELLOW}Note: Trivy not installed. Skipping security scan.${NC}"
    echo -e "Install Trivy: https://github.com/aquasecurity/trivy"
    echo ""
fi

# Push to registry if requested
if [ "$PUSH" = true ]; then
    echo -e "${YELLOW}Pushing image to registry...${NC}"
    docker push "${IMAGE_NAME}:${VERSION}"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Image pushed successfully${NC}"
    else
        echo -e "${RED}✗ Failed to push image${NC}"
        exit 1
    fi
fi

# Summary
echo ""
echo -e "${BLUE}=================================================${NC}"
echo -e "${GREEN}Build completed successfully!${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""
echo -e "Image: ${BLUE}${IMAGE_NAME}:${VERSION}${NC}"
echo ""
echo -e "Next steps:"
echo -e "  1. Test locally: ${YELLOW}docker-compose up${NC}"
echo -e "  2. Deploy to K8s: ${YELLOW}./scripts/deploy-k8s.sh${NC}"
echo ""
