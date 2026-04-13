#!/bin/bash
# VMS Channel Bridge Docs - Stop Development Server Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "================================================"
echo "  VMS Channel Bridge Docs - Stop Server"
echo "================================================"
echo ""

# Check if container is running
if docker ps --format '{{.Names}}' | grep -q '^vms-docs$'; then
    echo "🛑 Stopping Docusaurus development server..."
    echo ""
    docker compose down
    echo ""
    echo "✅ Server stopped successfully!"
else
    echo "ℹ️  No running container found."
fi

echo ""
