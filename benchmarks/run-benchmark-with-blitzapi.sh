#!/bin/bash

echo "🚀 Starting BlitzAPI server manually (required for uWebSockets on Node 22)..."
cd "$(dirname "$0")"

# Start BlitzAPI in background
PORT=3000 node servers/blitzapi-server.js &
BLITZ_PID=$!

# Wait for it to start
sleep 3

# Check if it's running
if curl -s http://localhost:3000/json > /dev/null 2>&1; then
    echo "✓ BlitzAPI is running"
    
    # Run benchmark
    echo ""
    node benchmark.js
    
    # Kill BlitzAPI
    kill $BLITZ_PID 2>/dev/null
    echo "✓ Cleaned up BlitzAPI"
else
    echo "✗ BlitzAPI failed to start"
    kill $BLITZ_PID 2>/dev/null
    exit 1
fi
