#!/bin/bash
# Comms Monitor Launcher
# Starts both backend (port 3001) and frontend (port 5173)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Comms Monitor ==="
echo "Starting services..."

# Check if dependencies are installed
if [ ! -d "$PROJECT_DIR/server/node_modules" ]; then
    echo "[Setup] Installing server dependencies..."
    cd "$PROJECT_DIR/server" && npm install
fi

if [ ! -d "$PROJECT_DIR/ui/node_modules" ]; then
    echo "[Setup] Installing UI dependencies..."
    cd "$PROJECT_DIR/ui" && npm install
fi

# Start backend in background
echo "[Backend] Starting on port 3001..."
cd "$PROJECT_DIR/server" && npm start &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 2

# Start frontend
echo "[Frontend] Starting on port 5173..."
cd "$PROJECT_DIR/ui" && npm run dev &
FRONTEND_PID=$!

echo ""
echo "=== Services Running ==="
echo "Backend:  http://localhost:3001"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services"

# Cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for either process to exit
wait
