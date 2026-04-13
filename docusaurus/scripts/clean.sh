#!/bin/bash
# VMS Channel Bridge Docs - Cleanup Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "================================================"
echo "  VMS Channel Bridge Docs - Cleanup"
echo "================================================"
echo ""
echo "This will remove:"
echo "  - Docker containers and volumes"
echo "  - node_modules directory"
echo "  - .docusaurus cache"
echo "  - Build artifacts"
echo ""
read -p "Are you sure? (y/N): " confirm

if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo "🧹 Cleaning up..."
echo ""

# Stop and remove containers and volumes
if docker ps -a --format '{{.Names}}' | grep -q '^vms-docs$'; then
    echo "📦 Removing Docker containers and volumes..."
    docker compose down -v
fi

# Remove node_modules
if [ -d "node_modules" ]; then
    echo "📂 Removing node_modules..."
    rm -rf node_modules
fi

# Remove .docusaurus cache
if [ -d ".docusaurus" ]; then
    echo "🗑️  Removing .docusaurus cache..."
    rm -rf .docusaurus
fi

# Remove build directory
if [ -d "build" ]; then
    echo "🗑️  Removing build artifacts..."
    rm -rf build
fi

echo ""
echo "✅ Cleanup completed!"
echo ""
echo "To start fresh:"
echo "  ./scripts/dev.sh"
echo ""
