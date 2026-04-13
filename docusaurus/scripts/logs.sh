#!/bin/bash
# VMS Channel Bridge Docs - View Logs Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "================================================"
echo "  VMS Channel Bridge Docs - Live Logs"
echo "================================================"
echo ""
echo "📋 Showing live logs (Ctrl+C to exit)..."
echo ""

docker compose logs -f --tail=100
