#!/bin/bash
# VMS Chat Ops Docs - Production Build Test Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "================================================"
echo "  VMS Chat Ops Docs - Production Build"
echo "================================================"
echo ""

echo "🏗️  Building production Docker image..."
echo ""

# Build production image
docker build -t vms-chat-ops-docs:latest -f Dockerfile .

echo ""
echo "✅ Build completed successfully!"
echo ""
echo "📦 Image: vms-chat-ops-docs:latest"
echo ""
echo "To test the production build:"
echo "  docker run -d -p 8080:80 --name vms-docs-prod vms-chat-ops-docs:latest"
echo "  # Visit: http://localhost:8080"
echo "  docker stop vms-docs-prod && docker rm vms-docs-prod"
echo ""
