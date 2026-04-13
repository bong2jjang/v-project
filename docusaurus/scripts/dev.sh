#!/bin/bash
# VMS Channel Bridge Docs - Development Server Start Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "================================================"
echo "  VMS Channel Bridge Docs - Development Mode"
echo "================================================"
echo ""

# Check if container is already running
if docker ps --format '{{.Names}}' | grep -q '^vms-docs$'; then
    echo "⚠️  Container 'vms-docs' is already running."
    echo ""
    echo "Choose an option:"
    echo "  1) Restart the container"
    echo "  2) View logs"
    echo "  3) Exit"
    read -p "Enter choice [1-3]: " choice

    case $choice in
        1)
            echo ""
            echo "🔄 Restarting container..."
            docker compose restart
            ;;
        2)
            echo ""
            echo "📋 Showing logs (Ctrl+C to exit)..."
            docker compose logs -f
            exit 0
            ;;
        3)
            echo "Exiting..."
            exit 0
            ;;
        *)
            echo "Invalid choice. Exiting..."
            exit 1
            ;;
    esac
else
    echo "🚀 Starting Docusaurus development server..."
    echo ""
    docker compose up -d
fi

echo ""
echo "✅ Development server started!"
echo ""
echo "📍 Docs available at: http://localhost:3000"
echo ""
echo "Useful commands:"
echo "  📋 View logs:     ./scripts/logs.sh"
echo "  🛑 Stop server:   ./scripts/stop.sh"
echo "  🧹 Clean up:      ./scripts/clean.sh"
echo ""
echo "📋 Showing live logs (Ctrl+C to exit)..."
echo "================================================"
echo ""

docker compose logs -f
