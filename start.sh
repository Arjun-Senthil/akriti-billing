#!/bin/bash
# start.sh — Start both Akriti Billing servers
# Run: bash ~/Documents/akriti-billing/start.sh
#
# Ctrl+C stops both servers cleanly.

ROOT="$HOME/Documents/akriti-billing"

echo ""
echo "  ========================================"
echo "    Akriti Billing — Starting up..."
echo "    Server → http://localhost:3001"
echo "    Client → http://localhost:5173"
echo "  ========================================"
echo ""

# Start backend in background, capture its PID so we can kill it on exit
(cd "$ROOT/server" && node src/index.js) &
SERVER_PID=$!

# Give the server 2 seconds to boot before starting the client
sleep 2

# Start frontend in foreground — Ctrl+C here stops this script
(cd "$ROOT/client" && npm run dev)

# When the client stops (Ctrl+C), kill the server too
echo ""
echo "  Shutting down server..."
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null
echo "  Done."
