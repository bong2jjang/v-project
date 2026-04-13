#!/bin/bash
# VMS Channel Bridge Docs - Production Build Test Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "================================================"
echo "  VMS Channel Bridge Docs - Production Build"
echo "================================================"
echo ""

echo "🏗️  Building production Docker image..."
echo ""

# Build production image
docker build -t vms-channel-bridge-docs:latest -f Dockerfile .

echo ""
echo "✅ Build completed successfully!"
echo ""
echo "📦 Image: vms-channel-bridge-docs:latest"
echo ""
echo "To test the production build:"
echo "  docker run -d -p 8080:80 --name vms-docs-prod vms-channel-bridge-docs:latest"
echo "  # Visit: http://localhost:8080"
echo "  docker stop vms-docs-prod && docker rm vms-docs-prod"
echo ""
