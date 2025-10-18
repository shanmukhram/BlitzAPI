#!/bin/bash

# Flow Visualization Test Script
# This script tests the flow visualization endpoints

echo "🧪 Testing Flow Visualization"
echo "============================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Server URL
SERVER="http://localhost:3000"

echo "1️⃣  Making a test request to /dashboard..."
RESPONSE=$(curl -s "$SERVER/dashboard?userId=123")
TRACE_ID=$(echo "$RESPONSE" | grep -o '"traceId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TRACE_ID" ]; then
  echo -e "${RED}❌ Failed to get traceId${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Got traceId: $TRACE_ID${NC}"
echo ""

# Wait a moment for flow to be stored
sleep 1

echo "2️⃣  Testing /profile/:traceId/flow (JSON)..."
curl -s "$SERVER/profile/$TRACE_ID/flow" > /dev/null
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ JSON endpoint working${NC}"
else
  echo -e "${RED}❌ JSON endpoint failed${NC}"
fi
echo ""

echo "3️⃣  Testing /profile/:traceId/waterfall (ASCII)..."
echo -e "${YELLOW}"
curl -s "$SERVER/profile/$TRACE_ID/waterfall"
echo -e "${NC}"
echo ""

echo "4️⃣  Testing /profile/:traceId/mermaid (Diagram)..."
echo -e "${YELLOW}"
curl -s "$SERVER/profile/$TRACE_ID/mermaid" | head -20
echo "..."
echo -e "${NC}"
echo ""

echo "5️⃣  Testing /flow/stats..."
echo -e "${YELLOW}"
curl -s "$SERVER/flow/stats"
echo -e "${NC}"
echo ""

echo "6️⃣  Testing /flow/slow..."
SLOW=$(curl -s "$SERVER/flow/slow?format=json")
COUNT=$(echo "$SLOW" | grep -o '"traceId"' | wc -l | tr -d ' ')
echo -e "${GREEN}✅ Found $COUNT flows${NC}"
echo ""

echo "============================================================"
echo -e "${GREEN}✅ All tests completed!${NC}"
echo ""
echo "💡 Try these commands:"
echo "  curl $SERVER/profile/$TRACE_ID/waterfall"
echo "  curl $SERVER/profile/$TRACE_ID/mermaid"
echo "  curl $SERVER/flow/stats"
